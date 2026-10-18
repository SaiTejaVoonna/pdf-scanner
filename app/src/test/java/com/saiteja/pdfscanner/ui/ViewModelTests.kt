package com.saiteja.pdfscanner.ui

import androidx.lifecycle.SavedStateHandle
import com.saiteja.pdfscanner.R
import com.saiteja.pdfscanner.TestFixtures
import com.saiteja.pdfscanner.TestFixtures.awaitMatch
import com.saiteja.pdfscanner.domain.PageFilter
import com.saiteja.pdfscanner.domain.Pt
import com.saiteja.pdfscanner.domain.Quad
import com.saiteja.pdfscanner.ui.document.DocumentEvent
import com.saiteja.pdfscanner.ui.document.DocumentViewModel
import com.saiteja.pdfscanner.ui.edit.EditEvent
import com.saiteja.pdfscanner.ui.edit.EditPageViewModel
import com.saiteja.pdfscanner.ui.edit.EditStep
import com.saiteja.pdfscanner.ui.home.HomeViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34])
class EditPageViewModelTest {
    @Before fun setUp() = TestFixtures.useUnconfinedMain()
    @After fun tearDown() = TestFixtures.resetMain()

    @Test
    fun `loads the page and renders the enhance preview once without looping`() = runBlocking {
        val c = TestFixtures.container()
        TestFixtures.seedDocument(c, "doc", 1)
        val vm = EditPageViewModel(c, SavedStateHandle(mapOf("pageId" to "doc-0")))
        val loaded = vm.state.awaitMatch { !it.loading }
        assertFalse(loaded.failed)
        assertNotNull(loaded.source)

        vm.setStep(EditStep.ENHANCE)
        val rendered = vm.state.awaitMatch { it.preview != null && !it.rendering }
        delay(600) // a render loop would keep replacing the bitmap during this window
        val later = vm.state.value
        assertSame("preview must be stable once rendered", rendered.preview, later.preview)
        assertFalse(later.rendering)
    }

    @Test
    fun `filter and rotation changes re-render and save persists edits`() = runBlocking {
        val c = TestFixtures.container()
        TestFixtures.seedDocument(c, "doc", 1)
        val vm = EditPageViewModel(c, SavedStateHandle(mapOf("pageId" to "doc-0")))
        vm.state.awaitMatch { !it.loading }
        vm.setStep(EditStep.ENHANCE)
        vm.state.awaitMatch { it.preview != null && !it.rendering }

        vm.rotate(clockwise = true)
        vm.setFilter(PageFilter.BLACK_WHITE)
        val after = vm.state.awaitMatch { it.preview != null && !it.rendering && it.rotation == 90 && it.filter == PageFilter.BLACK_WHITE && it.preview.width > it.preview.height }
        assertTrue(after.dirty)

        vm.moveCorner(0, Pt(0.1f, 0.1f))
        vm.save()
        val saved = withTimeout(10_000) { while (c.repository.getPage("doc-0")!!.rotation != 90) delay(50); c.repository.getPage("doc-0")!! }
        assertEquals(PageFilter.BLACK_WHITE, saved.filter)
        assertEquals(Pt(0.1f, 0.1f), saved.corners.tl)
        assertEquals(Pt(1f, 0f), saved.corners.tr)
    }

    @Test
    fun `rotation wraps around in both directions`() = runBlocking {
        val c = TestFixtures.container()
        TestFixtures.seedDocument(c, "doc", 1)
        val vm = EditPageViewModel(c, SavedStateHandle(mapOf("pageId" to "doc-0")))
        vm.state.awaitMatch { !it.loading }
        repeat(4) { vm.rotate(true) }
        assertEquals(0, vm.state.value.rotation)
        vm.rotate(false)
        assertEquals(270, vm.state.value.rotation)
    }

    @Test
    fun `invalid crop cannot be saved or previewed and reports why`() = runBlocking {
        val c = TestFixtures.container()
        TestFixtures.seedDocument(c, "doc", 1)
        val vm = EditPageViewModel(c, SavedStateHandle(mapOf("pageId" to "doc-0")))
        vm.state.awaitMatch { !it.loading }
        // Drag top-left past bottom-right: still convex, but wound the wrong way (page would flip).
        vm.moveCorner(0, Pt(1f, 1f))
        vm.moveCorner(2, Pt(0f, 0f))
        assertFalse(vm.state.value.corners.isValidCrop())

        vm.setStep(EditStep.ENHANCE)
        assertEquals(EditStep.CROP, vm.state.value.step)
        val first = withTimeout(5_000) { vm.eventFlow.first() }
        assertEquals(R.string.msg_invalid_crop, (first as EditEvent.Message).message.res)

        vm.save()
        assertEquals(R.string.msg_invalid_crop, ((withTimeout(5_000) { vm.eventFlow.first() }) as EditEvent.Message).message.res)
        assertEquals(Quad.FULL, c.repository.getPage("doc-0")!!.corners)
    }

    @Test
    fun `reset restores the full frame and edits survive process death via saved state`() = runBlocking {
        val c = TestFixtures.container()
        TestFixtures.seedDocument(c, "doc", 1)
        val handle = SavedStateHandle(mapOf("pageId" to "doc-0"))
        val vm = EditPageViewModel(c, handle)
        vm.state.awaitMatch { !it.loading }
        vm.moveCorner(1, Pt(0.8f, 0.2f))
        vm.rotate(true)
        vm.setFilter(PageFilter.GRAYSCALE)

        val restored = EditPageViewModel(c, handle) // same handle = recreated after process death
        val s = restored.state.awaitMatch { !it.loading }
        assertEquals(Pt(0.8f, 0.2f), s.corners.tr)
        assertEquals(90, s.rotation)
        assertEquals(PageFilter.GRAYSCALE, s.filter)
        assertTrue(s.dirty)

        restored.resetCorners()
        assertTrue(restored.state.value.corners.isFullFrame())
    }

    @Test
    fun `missing page shows failure state instead of crashing`() = runBlocking {
        val c = TestFixtures.container()
        val vm = EditPageViewModel(c, SavedStateHandle(mapOf("pageId" to "nope")))
        val s = vm.state.awaitMatch { !it.loading }
        assertTrue(s.failed)
    }

    @Test
    fun `unreadable source image shows failure state instead of crashing`() = runBlocking {
        val c = TestFixtures.container()
        val id = TestFixtures.seedDocument(c, "doc", 1)
        c.fileStore.pageFile(id, "doc-0.jpg").writeText("not an image")
        val vm = EditPageViewModel(c, SavedStateHandle(mapOf("pageId" to "doc-0")))
        assertTrue(vm.state.awaitMatch { !it.loading }.failed)
    }
}

@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34])
class DocumentViewModelTest {
    @Before fun setUp() = TestFixtures.useUnconfinedMain()
    @After fun tearDown() = TestFixtures.resetMain()

    @Test
    fun `reorder remove and rename flow through to the state`() = runBlocking {
        val c = TestFixtures.container()
        val id = TestFixtures.seedDocument(c, "doc", 3, finalized = false)
        val vm = DocumentViewModel(c, SavedStateHandle(mapOf("docId" to id)))
        val s0 = vm.state.awaitMatch { it.loaded && it.pages.size == 3 }
        assertTrue(s0.document!!.isDraft)

        vm.movePage("doc-0", 1)
        assertEquals(listOf("doc-1", "doc-0", "doc-2"), vm.state.awaitMatch { it.pages.firstOrNull()?.id == "doc-1" }.pages.map { it.id })

        vm.removePage("doc-1")
        assertEquals(listOf("doc-0", "doc-2"), vm.state.awaitMatch { it.pages.size == 2 }.pages.map { it.id })

        vm.rename("Tax / 2025")
        assertEquals("Tax 2025", vm.state.awaitMatch { it.document?.name == "Tax 2025" }.document!!.name)
        assertEquals("Tax 2025", vm.state.value.exportName)
    }

    @Test
    fun `selection mode applies bulk edits only to the selected pages`() = runBlocking {
        val c = TestFixtures.container()
        val id = TestFixtures.seedDocument(c, "doc", 4, finalized = false)
        val vm = DocumentViewModel(c, SavedStateHandle(mapOf("docId" to id)))
        vm.state.awaitMatch { it.loaded && it.pages.size == 4 }

        vm.toggleSelection("doc-1"); vm.toggleSelection("doc-3")
        assertEquals(setOf("doc-1", "doc-3"), vm.state.awaitMatch { it.selection.size == 2 }.selection)

        vm.applyFilterToSelection(PageFilter.BLACK_WHITE)
        vm.rotateSelection(clockwise = true)
        vm.state.awaitMatch { s -> s.pages.first { it.id == "doc-1" }.filter == PageFilter.BLACK_WHITE && s.pages.first { it.id == "doc-1" }.rotation == 90 }
        val pages = c.repository.getPages(id).associateBy { it.id }
        assertEquals(PageFilter.ORIGINAL, pages["doc-0"]!!.filter)
        assertEquals(0, pages["doc-2"]!!.rotation)
        assertEquals(PageFilter.BLACK_WHITE, pages["doc-3"]!!.filter)
        assertEquals(90, pages["doc-3"]!!.rotation)

        vm.toggleSelection("doc-1") // deselect
        assertEquals(setOf("doc-3"), vm.state.awaitMatch { it.selection.size == 1 }.selection)
        vm.selectAll()
        assertEquals(4, vm.state.awaitMatch { it.selection.size == 4 }.selection.size)
        vm.clearSelection()
        assertTrue(vm.state.awaitMatch { it.selection.isEmpty() }.selection.isEmpty())
    }

    @Test
    fun `remove crop and delete selection`() = runBlocking {
        val c = TestFixtures.container()
        val id = TestFixtures.seedDocument(c, "doc", 3, finalized = false)
        val crop = Quad(Pt(0.1f, 0.1f), Pt(0.9f, 0.1f), Pt(0.9f, 0.9f), Pt(0.1f, 0.9f))
        c.repository.updatePages(c.repository.getPages(id).map { it.copy(corners = crop) })
        val vm = DocumentViewModel(c, SavedStateHandle(mapOf("docId" to id)))
        vm.state.awaitMatch { it.loaded && it.pages.size == 3 }

        vm.toggleSelection("doc-0")
        vm.state.awaitMatch { it.selection.size == 1 }
        vm.resetCropOfSelection()
        vm.state.awaitMatch { s -> s.pages.first { it.id == "doc-0" }.corners.isFullFrame() }
        assertFalse(c.repository.getPage("doc-1")!!.corners.isFullFrame())

        vm.toggleSelection("doc-2")
        vm.state.awaitMatch { it.selection.size == 2 }
        vm.deleteSelection()
        assertEquals(listOf("doc-1"), vm.state.awaitMatch { it.pages.size == 1 }.pages.map { it.id })
        assertTrue(vm.state.value.selection.isEmpty())
        assertEquals(listOf(0), c.repository.getPages(id).map { it.position })
    }

    @Test
    fun `selection survives recreation through saved state and ignores deleted pages`() = runBlocking {
        val c = TestFixtures.container()
        val id = TestFixtures.seedDocument(c, "doc", 3, finalized = false)
        val handle = SavedStateHandle(mapOf("docId" to id))
        val vm = DocumentViewModel(c, handle)
        vm.state.awaitMatch { it.pages.size == 3 }
        vm.toggleSelection("doc-0"); vm.toggleSelection("doc-2")

        val restored = DocumentViewModel(c, handle)
        assertEquals(setOf("doc-0", "doc-2"), restored.state.awaitMatch { it.selection.size == 2 }.selection)
        c.repository.removePage("doc-2")
        assertEquals(setOf("doc-0"), restored.state.awaitMatch { it.pages.size == 2 }.selection)
    }

    @Test
    fun `auto crop of selection leaves pages without clear edges unchanged`() = runBlocking {
        val c = TestFixtures.container()
        val id = TestFixtures.seedDocument(c, "doc", 2, finalized = false) // flat grey pages: nothing to detect
        val vm = DocumentViewModel(c, SavedStateHandle(mapOf("docId" to id)))
        vm.state.awaitMatch { it.pages.size == 2 }
        vm.selectAll()
        vm.state.awaitMatch { it.selection.size == 2 }
        vm.autoCropSelection()
        val event = withTimeout(30_000) { vm.eventFlow.first() } as DocumentEvent.Message
        assertEquals(R.string.msg_autocrop_result, event.message.res)
        assertEquals(0, event.message.args[0])
        assertTrue(c.repository.getPages(id).all { it.corners.isFullFrame() })
    }

    @Test
    fun `save to library finalizes the draft and closes`() = runBlocking {
        val c = TestFixtures.container()
        val id = TestFixtures.seedDocument(c, "doc", 1, finalized = false)
        val vm = DocumentViewModel(c, SavedStateHandle(mapOf("docId" to id)))
        vm.state.awaitMatch { it.loaded && it.pages.isNotEmpty() }
        vm.saveToLibrary()
        assertTrue(withTimeout(5_000) { vm.eventFlow.first() } is DocumentEvent.Close)
        assertFalse(c.repository.getDocument(id)!!.isDraft)
    }

    @Test
    fun `discard deletes the draft and its files`() = runBlocking {
        val c = TestFixtures.container()
        val id = TestFixtures.seedDocument(c, "doc", 2, finalized = false)
        val vm = DocumentViewModel(c, SavedStateHandle(mapOf("docId" to id)))
        vm.state.awaitMatch { it.loaded }
        vm.discard()
        assertTrue(withTimeout(5_000) { vm.eventFlow.first() } is DocumentEvent.Close)
        assertNull(c.repository.getDocument(id))
        assertFalse(c.fileStore.documentDir(id).listFiles().orEmpty().any { it.name.endsWith(".jpg") })
    }

    @Test
    fun `share exports a pdf into the cache and emits a share event`() = runBlocking {
        val c = TestFixtures.container()
        val id = TestFixtures.seedDocument(c, "doc", 2)
        val vm = DocumentViewModel(c, SavedStateHandle(mapOf("docId" to id)))
        vm.state.awaitMatch { it.loaded && it.pages.size == 2 }
        vm.setExportName("Quarterly: report")
        vm.share()
        val event = withTimeout(30_000) { vm.eventFlow.first() } as DocumentEvent.Share
        assertEquals("Quarterly report.pdf", event.file.name)
        assertTrue(event.file.readBytes().toString(Charsets.ISO_8859_1).startsWith("%PDF-1.4"))
        assertNull(vm.state.awaitMatch { it.export == null }.export)
    }

    @Test
    fun `save to a user chosen uri writes the pdf and a failing destination reports an error`() = runBlocking {
        val c = TestFixtures.container()
        val id = TestFixtures.seedDocument(c, "doc", 1)
        val vm = DocumentViewModel(c, SavedStateHandle(mapOf("docId" to id)))
        vm.state.awaitMatch { it.loaded && it.pages.size == 1 }

        val target = java.io.File(c.fileStore.captureDir, "chosen.pdf")
        vm.saveTo(android.net.Uri.fromFile(target))
        val ok = withTimeout(30_000) { vm.eventFlow.first() } as DocumentEvent.Message
        assertEquals(R.string.msg_pdf_saved, ok.message.res)
        assertTrue(target.readBytes().toString(Charsets.ISO_8859_1).startsWith("%PDF-1.4"))

        vm.state.awaitMatch { it.export == null }
        // A directory can't be opened for writing: must surface as a message, not a crash.
        vm.saveTo(android.net.Uri.fromFile(c.fileStore.captureDir))
        val err = withTimeout(30_000) { vm.eventFlow.first() } as DocumentEvent.Message
        assertEquals(R.string.msg_export_failed, err.message.res)
    }
}

@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34])
class HomeViewModelTest {
    @Before fun setUp() = TestFixtures.useUnconfinedMain()
    @After fun tearDown() = TestFixtures.resetMain()

    @Test
    fun `lists saved documents, filters by search and surfaces drafts separately`() = runBlocking {
        val c = TestFixtures.container()
        TestFixtures.seedDocument(c, "Rental agreement", 2)
        TestFixtures.seedDocument(c, "Passport", 1)
        TestFixtures.seedDocument(c, "Unfinished", 1, finalized = false)
        val vm = HomeViewModel(c, SavedStateHandle())

        val all = vm.state.awaitMatch { !it.loading && it.totalCount == 2 }
        assertEquals(2, all.documents.size)
        assertEquals("Unfinished", all.draft!!.document.name)

        vm.setQuery("rent")
        val filtered = vm.state.awaitMatch { it.query == "rent" }
        assertEquals(listOf("Rental agreement"), filtered.documents.map { it.document.name })
        assertEquals(2, filtered.totalCount)

        vm.setQuery("zzz")
        val none = vm.state.awaitMatch { it.query == "zzz" }
        assertTrue(none.documents.isEmpty())
        assertEquals(2, none.totalCount)
    }

    @Test
    fun `rename and delete update the library and remove files`() = runBlocking {
        val c = TestFixtures.container()
        val id = TestFixtures.seedDocument(c, "Old name", 1)
        val vm = HomeViewModel(c, SavedStateHandle())
        vm.state.awaitMatch { it.totalCount == 1 }

        vm.rename(id, "New name")
        assertEquals("New name", vm.state.awaitMatch { it.documents.firstOrNull()?.document?.name == "New name" }.documents.single().document.name)

        vm.delete(id)
        assertEquals(0, vm.state.awaitMatch { it.totalCount == 0 }.documents.size)
        assertNull(c.repository.getDocument(id))
    }

    @Test
    fun `importing unreadable images reports failure and creates no document`() = runBlocking {
        val c = TestFixtures.container()
        val bad = java.io.File(c.fileStore.captureDir, "bad.jpg").apply { writeText("garbage") }
        val vm = HomeViewModel(c, SavedStateHandle())
        vm.importPhotos(listOf(android.net.Uri.fromFile(bad), android.net.Uri.parse("content://nonexistent/1")))
        val event = withTimeout(15_000) { vm.eventFlow.first() }
        assertTrue(event is com.saiteja.pdfscanner.ui.home.HomeEvent.Message)
        assertEquals(R.string.msg_some_images_failed, (event as com.saiteja.pdfscanner.ui.home.HomeEvent.Message).message.res)
        assertTrue(c.repository.observeDrafts().first().isEmpty())
        assertTrue(c.repository.observeLibrary().first().isEmpty())
    }

    @Test
    fun `importing valid images creates a draft page per image with auto crop when enabled`() = runBlocking {
        val c = TestFixtures.container()
        c.settings.update { it.copy(autoCropImport = true) }
        val files = (0 until 2).map { i ->
            val bmp = android.graphics.Bitmap.createBitmap(500, 700, android.graphics.Bitmap.Config.ARGB_8888)
            bmp.eraseColor(android.graphics.Color.rgb(40, 40, 40))
            val canvas = android.graphics.Canvas(bmp)
            canvas.drawRect(80f, 100f, 420f, 620f, android.graphics.Paint().apply { color = android.graphics.Color.rgb(235, 235, 225) })
            java.io.File(c.fileStore.captureDir, "in$i.jpg").also { f -> f.outputStream().use { bmp.compress(android.graphics.Bitmap.CompressFormat.JPEG, 90, it) } }
        }
        val vm = HomeViewModel(c, SavedStateHandle())
        vm.importPhotos(files.map { android.net.Uri.fromFile(it) })
        val event = withTimeout(30_000) { vm.eventFlow.first() } as com.saiteja.pdfscanner.ui.home.HomeEvent.OpenDocument
        val pages = c.repository.getPages(event.documentId)
        assertEquals(2, pages.size)
        assertEquals(listOf(0, 1), pages.map { it.position })
        assertTrue(c.repository.getDocument(event.documentId)!!.isDraft)
        // Edge detection should have found the lighter sheet rather than falling back to the full frame.
        assertFalse(pages[0].corners.isFullFrame())
        assertEquals(0.16f, pages[0].corners.tl.x, 0.04f)
        assertEquals(0.14f, pages[0].corners.tl.y, 0.04f)
        assertEquals(0.84f, pages[0].corners.br.x, 0.04f)
        assertEquals(0.89f, pages[0].corners.br.y, 0.04f)
        assertTrue(c.fileStore.pageFile(event.documentId, pages[0].sourceFile).exists())
    }

    @Test
    fun `imported images keep the full frame by default`() = runBlocking {
        val c = TestFixtures.container()
        assertFalse(c.settings.current.autoCropImport)
        val bmp = android.graphics.Bitmap.createBitmap(500, 700, android.graphics.Bitmap.Config.ARGB_8888)
        bmp.eraseColor(android.graphics.Color.rgb(40, 40, 40))
        android.graphics.Canvas(bmp).drawRect(80f, 100f, 420f, 620f, android.graphics.Paint().apply { color = android.graphics.Color.rgb(235, 235, 225) })
        val file = java.io.File(c.fileStore.captureDir, "plain.jpg").also { f -> f.outputStream().use { bmp.compress(android.graphics.Bitmap.CompressFormat.JPEG, 90, it) } }
        val vm = HomeViewModel(c, SavedStateHandle())
        vm.importPhotos(listOf(android.net.Uri.fromFile(file)))
        val event = withTimeout(30_000) { vm.eventFlow.first() } as com.saiteja.pdfscanner.ui.home.HomeEvent.OpenDocument
        assertTrue(c.repository.getPages(event.documentId).single().corners.isFullFrame())
    }

    @Test
    fun `default filter setting is applied to new pages`() = runBlocking {
        val c = TestFixtures.container()
        c.settings.update { it.copy(defaultFilter = com.saiteja.pdfscanner.domain.PageFilter.ENHANCED) }
        val bmp = android.graphics.Bitmap.createBitmap(200, 300, android.graphics.Bitmap.Config.ARGB_8888)
        bmp.eraseColor(android.graphics.Color.GRAY)
        val file = java.io.File(c.fileStore.captureDir, "f.jpg").also { f -> f.outputStream().use { bmp.compress(android.graphics.Bitmap.CompressFormat.JPEG, 90, it) } }
        val vm = HomeViewModel(c, SavedStateHandle())
        vm.importPhotos(listOf(android.net.Uri.fromFile(file)))
        val event = withTimeout(30_000) { vm.eventFlow.first() } as com.saiteja.pdfscanner.ui.home.HomeEvent.OpenDocument
        assertEquals(com.saiteja.pdfscanner.domain.PageFilter.ENHANCED, c.repository.getPages(event.documentId).single().filter)
    }

    @Test
    fun `importing a file that is not a pdf reports failure and creates no document`() = runBlocking {
        val c = TestFixtures.container()
        val bad = java.io.File(c.fileStore.captureDir, "bad.pdf").apply { writeText("this is not a pdf") }
        val vm = HomeViewModel(c, SavedStateHandle())
        vm.importPdfs(listOf(android.net.Uri.fromFile(bad)))
        val event = withTimeout(15_000) { vm.eventFlow.first() } as com.saiteja.pdfscanner.ui.home.HomeEvent.Message
        assertEquals(R.string.msg_pdf_import_failed, event.message.res)
        assertTrue(c.repository.observeDrafts().first().isEmpty())
    }
}
