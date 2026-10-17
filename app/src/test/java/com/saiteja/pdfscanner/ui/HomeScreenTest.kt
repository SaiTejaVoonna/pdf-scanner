package com.saiteja.pdfscanner.ui

import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onLast
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextClearance
import androidx.compose.ui.test.performTextInput
import androidx.test.core.app.ApplicationProvider
import com.saiteja.pdfscanner.PdfScannerApp
import com.saiteja.pdfscanner.TestFixtures
import com.saiteja.pdfscanner.ui.components.LocalThumbnails
import com.saiteja.pdfscanner.ui.home.HomeScreen
import com.saiteja.pdfscanner.ui.theme.PdfScannerTheme
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34], application = PdfScannerApp::class)
class HomeScreenTest {
    @get:Rule val rule = createComposeRule()

    private val container get() = ApplicationProvider.getApplicationContext<PdfScannerApp>().container

    private fun show(onScan: () -> Unit = {}, onOpen: (String) -> Unit = {}) {
        rule.setContent {
            PdfScannerTheme {
                CompositionLocalProvider(LocalThumbnails provides container.thumbnails) {
                    HomeScreen(onScan = onScan, onOpenDocument = onOpen, onResumeDraft = onOpen)
                }
            }
        }
    }

    /** Document rows expose one merged TalkBack description: "<name>, <n pages>, modified <date>". */
    private fun docRow(name: String) = hasContentDescription("$name,", substring = true)
    private fun waitForDoc(name: String) = rule.waitUntil(10_000) { rule.onAllNodes(docRow(name)).fetchSemanticsNodes().isNotEmpty() }
    private fun waitDocGone(name: String) = rule.waitUntil(10_000) { rule.onAllNodes(docRow(name)).fetchSemanticsNodes().isEmpty() }

    private fun waitForText(text: String) = rule.waitUntil(10_000) { rule.onAllNodes(hasText(text)).fetchSemanticsNodes().isNotEmpty() }
    private fun waitGone(text: String) = rule.waitUntil(10_000) { rule.onAllNodes(hasText(text)).fetchSemanticsNodes().isEmpty() }

    @Test
    fun `empty library shows guidance and a working scan button`() {
        var scans = 0
        show(onScan = { scans++ })
        waitForText("No documents yet")
        rule.onNodeWithText("Scan a document").assertIsDisplayed()
        // The emulated screen is only 470dp tall: the empty state must scroll rather than clip.
        rule.onNodeWithText("Import photos").performScrollTo().assertIsDisplayed()
        rule.onNodeWithText("Scan a document").performClick()
        assertEquals(1, scans)
        rule.onNodeWithText("Scan", useUnmergedTree = true).performClick() // the prominent FAB
        assertEquals(2, scans)
    }

    @Test
    fun `lists documents, filters with search and explains empty results`() {
        runBlocking {
            TestFixtures.seedDocument(container, "Rental agreement", 2)
            TestFixtures.seedDocument(container, "Passport", 1)
        }
        show()
        waitForDoc("Rental agreement")
        rule.onNode(docRow("Passport")).assertIsDisplayed()

        rule.onNodeWithText("Search documents").performTextInput("pass")
        waitDocGone("Rental agreement")
        rule.onNode(docRow("Passport")).assertIsDisplayed()

        rule.onNodeWithText("pass").performTextClearance()
        rule.onNodeWithText("Search documents").performTextInput("nothing")
        waitForText("No matches")
        rule.onNodeWithContentDescription("Clear search").performClick()
        waitForDoc("Rental agreement")
    }

    @Test
    fun `delete asks for confirmation and cancel keeps the document`() {
        val id = runBlocking { TestFixtures.seedDocument(container, "Contract", 1) }
        show()
        waitForDoc("Contract")
        rule.onNodeWithContentDescription("More actions for Contract").performClick()
        rule.onNodeWithText("Delete").performClick()
        waitForText("Delete document?")
        rule.onNodeWithText("Cancel").performClick()
        waitGone("Delete document?")
        rule.onNode(docRow("Contract")).assertIsDisplayed()
        runBlocking { assertEquals("Contract", container.repository.getDocument(id)!!.name) }
    }

    @Test
    fun `confirming delete removes the document and its files`() {
        val id = runBlocking { TestFixtures.seedDocument(container, "Contract", 1) }
        show()
        waitForDoc("Contract")
        rule.onNodeWithContentDescription("More actions for Contract").performClick()
        rule.onNodeWithText("Delete").performClick()
        waitForText("Delete document?")
        // Two nodes read "Delete" now (menu is gone, dialog button remains).
        rule.onAllNodesWithTextCompat("Delete").onLast().performClick()
        waitDocGone("Contract")
        runBlocking { assertNull(container.repository.getDocument(id)) }
    }

    @Test
    fun `rename updates the listed name`() {
        runBlocking { TestFixtures.seedDocument(container, "Scan 1", 1) }
        show()
        waitForDoc("Scan 1")
        rule.onNodeWithContentDescription("More actions for Scan 1").performClick()
        rule.onNodeWithText("Rename").performClick()
        waitForText("Rename document")
        rule.onAllNodesWithTextCompat("Scan 1").onLast().performTextClearance()
        rule.onNodeWithText("Name").performTextInput("Lease 2026")
        rule.onNodeWithText("Save").performClick()
        waitForDoc("Lease 2026")
    }

    @Test
    fun `an unfinished scan is offered for resume and can be discarded after confirmation`() {
        val draftId = runBlocking { TestFixtures.seedDocument(container, "Draft doc", 2, finalized = false) }
        runBlocking { TestFixtures.seedDocument(container, "Saved doc", 1) }
        var opened: String? = null
        show(onOpen = { opened = it })
        waitForText("Unfinished scan")
        rule.onNodeWithText("Resume").performClick()
        assertEquals(draftId, opened)

        rule.onNodeWithText("Discard").performClick()
        waitForText("Discard this scan?")
        rule.onAllNodesWithTextCompat("Discard").onLast().performClick()
        waitGone("Unfinished scan")
        runBlocking { assertNull(container.repository.getDocument(draftId)) }
    }

    private fun androidx.compose.ui.test.junit4.ComposeContentTestRule.onAllNodesWithTextCompat(text: String) =
        onAllNodes(hasText(text))
}
