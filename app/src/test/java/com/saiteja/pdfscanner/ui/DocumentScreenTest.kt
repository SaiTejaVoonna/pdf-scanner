package com.saiteja.pdfscanner.ui

import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.longClick
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTouchInput
import androidx.lifecycle.SavedStateHandle
import androidx.test.core.app.ApplicationProvider
import com.saiteja.pdfscanner.PdfScannerApp
import com.saiteja.pdfscanner.TestFixtures
import com.saiteja.pdfscanner.domain.PageFilter
import com.saiteja.pdfscanner.ui.components.LocalThumbnails
import com.saiteja.pdfscanner.ui.document.DocumentScreen
import com.saiteja.pdfscanner.ui.document.DocumentViewModel
import com.saiteja.pdfscanner.ui.home.HomeScreen
import com.saiteja.pdfscanner.ui.theme.PdfScannerTheme
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34], application = PdfScannerApp::class, qualifiers = "w411dp-h891dp")
class DocumentScreenTest {
    @get:Rule val rule = createComposeRule()
    private val container get() = ApplicationProvider.getApplicationContext<PdfScannerApp>().container

    private fun show(docId: String) {
        val vm = DocumentViewModel(container, SavedStateHandle(mapOf("docId" to docId)))
        rule.setContent {
            PdfScannerTheme {
                CompositionLocalProvider(LocalThumbnails provides container.thumbnails) {
                    DocumentScreen(onBack = {}, onAddPages = {}, onEditPage = { _, _ -> }, viewModel = vm)
                }
            }
        }
    }

    private fun waitForText(t: String) = rule.waitUntil(10_000) { rule.onAllNodes(hasText(t, substring = true)).fetchSemanticsNodes().isNotEmpty() }
    private fun waitForDesc(d: String) = rule.waitUntil(10_000) { rule.onAllNodes(hasContentDescription(d)).fetchSemanticsNodes().isNotEmpty() }

    @Test
    fun `long press starts selection, tapping toggles, bulk filter applies and close leaves selection mode`() {
        val id = runBlocking { TestFixtures.seedDocument(container, "doc", 3, finalized = false) }
        show(id)
        waitForDesc("Page 1 of 3")

        rule.onNodeWithContentDescription("Page 1 of 3").performTouchInput { longClick() }
        waitForText("1 selected")
        rule.onNodeWithContentDescription("Page 2 of 3").performClick() // tap now toggles instead of opening the editor
        waitForText("2 selected")

        rule.onNodeWithContentDescription("Select all").performClick()
        waitForText("3 selected")

        rule.onNodeWithContentDescription("Filter selected pages").performClick()
        rule.onNodeWithText("Black & white").performClick()
        rule.waitUntil(10_000) { runBlocking { container.repository.getPages(id).all { it.filter == PageFilter.BLACK_WHITE } } }

        rule.onNodeWithContentDescription("Clear selection").performClick()
        rule.waitUntil(10_000) { rule.onAllNodes(hasText("selected", substring = true)).fetchSemanticsNodes().isEmpty() }
        rule.onNodeWithText("Export PDF", useUnmergedTree = true).assertIsDisplayed()
    }

    @Test
    fun `deleting a selection asks first and cancel keeps the pages`() {
        val id = runBlocking { TestFixtures.seedDocument(container, "doc", 3, finalized = false) }
        show(id)
        waitForDesc("Page 1 of 3")
        rule.onNodeWithContentDescription("Page 1 of 3").performTouchInput { longClick() }
        waitForText("1 selected")
        rule.onNodeWithContentDescription("Delete").performClick()
        waitForText("1 page will be removed")
        rule.onNodeWithText("Cancel").performClick()
        assertEquals(3, runBlocking { container.repository.getPages(id).size })

        rule.onNodeWithContentDescription("Delete").performClick()
        waitForText("1 page will be removed")
        rule.onAllNodes(hasText("Delete")).fetchSemanticsNodes() // dialog button present
        rule.onNodeWithText("Delete").performClick()
        rule.waitUntil(10_000) { runBlocking { container.repository.getPages(id).size == 2 } }
    }

    @Test
    fun `export sheet offers size and quality choices`() {
        val id = runBlocking { TestFixtures.seedDocument(container, "doc", 2, finalized = true) }
        show(id)
        waitForDesc("Page 1 of 2")
        rule.onNodeWithText("Export PDF", useUnmergedTree = true).performClick()
        waitForText("PDF quality")
        rule.onNodeWithText("Small file").assertIsDisplayed()
        rule.onNodeWithText("Balanced").performClick()
        rule.onNodeWithText("A4").assertIsDisplayed()
        rule.onNodeWithText("Save to device").assertIsDisplayed()
    }
}

@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34], application = PdfScannerApp::class, qualifiers = "w411dp-h891dp")
class SettingsSheetTest {
    @get:Rule val rule = createComposeRule()
    private val container get() = ApplicationProvider.getApplicationContext<PdfScannerApp>().container

    @Test
    fun `settings can be changed from the home overflow menu and are stored`() {
        var resize = 0
        rule.setContent {
            PdfScannerTheme {
                CompositionLocalProvider(LocalThumbnails provides container.thumbnails) {
                    HomeScreen(onScan = {}, onOpenDocument = {}, onResumeDraft = {}, onOpenResize = { resize++ })
                }
            }
        }
        assertFalse(container.settings.current.autoCropImport)
        rule.onNodeWithContentDescription("More").performClick()
        rule.onNodeWithText("Settings").performClick()
        rule.waitUntil(10_000) { rule.onAllNodes(hasText("Auto-crop imported images")).fetchSemanticsNodes().isNotEmpty() }
        rule.onNodeWithText("Auto-crop imported images").performClick()
        rule.waitUntil(10_000) { container.settings.current.autoCropImport }
        rule.onNodeWithText("Auto-crop camera photos").performClick()
        rule.waitUntil(10_000) { !container.settings.current.autoCropCamera }
        rule.onNodeWithText("Enhanced").performClick()
        rule.waitUntil(10_000) { container.settings.current.defaultFilter == PageFilter.ENHANCED }
        assertTrue(rule.onAllNodes(hasText("beta", substring = true)).fetchSemanticsNodes().isNotEmpty())
    }

    @Test
    fun `overflow menu opens the resize tool`() {
        var resize = 0
        rule.setContent {
            PdfScannerTheme {
                CompositionLocalProvider(LocalThumbnails provides container.thumbnails) {
                    HomeScreen(onScan = {}, onOpenDocument = {}, onResumeDraft = {}, onOpenResize = { resize++ })
                }
            }
        }
        rule.onNodeWithContentDescription("More").performClick()
        rule.onNodeWithText("Resize images").performClick()
        assertEquals(1, resize)
    }
}
