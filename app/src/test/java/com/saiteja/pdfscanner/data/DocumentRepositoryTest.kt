package com.saiteja.pdfscanner.data

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.saiteja.pdfscanner.domain.PageFilter
import com.saiteja.pdfscanner.domain.PdfPageSize
import com.saiteja.pdfscanner.domain.Pt
import com.saiteja.pdfscanner.domain.Quad
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class DocumentRepositoryTest {
    private lateinit var db: AppDatabase
    private lateinit var files: FileStore
    private lateinit var repo: DocumentRepository
    private var now = 1_000L

    @Before
    fun setUp() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        db = Room.inMemoryDatabaseBuilder(context, AppDatabase::class.java).allowMainThreadQueries().build()
        files = FileStore(context)
        repo = DocumentRepository(db, files, clock = { now++ })
    }

    @After
    fun tearDown() {
        db.close()
    }

    private fun writePageFile(docId: String, name: String) = files.pageFile(docId, name).also { it.writeText("img") }

    private suspend fun docWithPages(vararg names: String): String {
        val doc = repo.createDraft("Doc")
        names.forEach { n -> writePageFile(doc.id, "$n.jpg"); repo.addPage(doc.id, "$n.jpg", pageId = n) }
        return doc.id
    }

    @Test
    fun `new documents are drafts and stay out of the library until finalized`() = runBlocking {
        val doc = repo.createDraft("Receipts")
        assertTrue(doc.isDraft)
        assertTrue(repo.observeLibrary().first().isEmpty())
        assertEquals(listOf(doc.id), repo.observeDrafts().first().map { it.document.id })

        repo.finalizeDraft(doc.id)
        assertEquals(listOf(doc.id), repo.observeLibrary().first().map { it.document.id })
        assertTrue(repo.observeDrafts().first().isEmpty())
    }

    @Test
    fun `pages are appended in order with consecutive positions`() = runBlocking {
        val id = docWithPages("p1", "p2", "p3")
        val pages = repo.getPages(id)
        assertEquals(listOf("p1", "p2", "p3"), pages.map { it.id })
        assertEquals(listOf(0, 1, 2), pages.map { it.position })
        assertEquals(Quad.FULL, pages[0].corners)
        assertEquals(PageFilter.ORIGINAL, pages[0].filter)
    }

    @Test
    fun `moving a page renumbers positions`() = runBlocking {
        val id = docWithPages("a", "b", "c", "d")
        repo.movePage(id, "d", 0)
        assertEquals(listOf("d", "a", "b", "c"), repo.getPages(id).map { it.id })
        repo.movePageBy(id, "a", 2)
        assertEquals(listOf("d", "b", "c", "a"), repo.getPages(id).map { it.id })
        assertEquals(listOf(0, 1, 2, 3), repo.getPages(id).map { it.position })
        repo.movePageBy(id, "d", -1) // already first: no-op
        assertEquals("d", repo.getPages(id).first().id)
        repo.movePage(id, "missing", 1) // unknown page: no-op, no crash
        assertEquals(4, repo.getPages(id).size)
    }

    @Test
    fun `removing a page closes the gap and deletes its image file`() = runBlocking {
        val id = docWithPages("a", "b", "c")
        val file = files.pageFile(id, "b.jpg")
        assertTrue(file.exists())
        repo.removePage("b")
        assertFalse(file.exists())
        val pages = repo.getPages(id)
        assertEquals(listOf("a", "c"), pages.map { it.id })
        assertEquals(listOf(0, 1), pages.map { it.position })
        repo.addPage(id, "x.jpg", pageId = "x") // appended after the compacted pages
        assertEquals(2, repo.getPages(id).last().position)
    }

    @Test
    fun `removing an unknown page is harmless`() = runBlocking {
        val id = docWithPages("a")
        repo.removePage("nope")
        assertEquals(1, repo.getPages(id).size)
    }

    @Test
    fun `page edits persist exactly`() = runBlocking {
        val id = docWithPages("a")
        val page = repo.getPage("a")!!
        val corners = Quad(Pt(0.1f, 0.2f), Pt(0.9f, 0.1f), Pt(0.95f, 0.9f), Pt(0.05f, 0.85f))
        repo.updatePage(page.copy(corners = corners, rotation = 270, filter = PageFilter.BLACK_WHITE))
        val saved = repo.getPages(id).single()
        assertEquals(corners, saved.corners)
        assertEquals(270, saved.rotation)
        assertEquals(PageFilter.BLACK_WHITE, saved.filter)
        assertTrue("render key must change so thumbnails refresh", page.renderKey != saved.renderKey)
    }

    @Test
    fun `rename sanitizes the name and keeps the old one when blank`() = runBlocking {
        val doc = repo.createDraft("Original")
        repo.rename(doc.id, "  New: name?  ")
        assertEquals("New name", repo.getDocument(doc.id)!!.name)
        repo.rename(doc.id, "   ")
        assertEquals("New name", repo.getDocument(doc.id)!!.name)
    }

    @Test
    fun `finalize can rename and page size persists`() = runBlocking {
        val doc = repo.createDraft("Draft")
        repo.setPageSize(doc.id, PdfPageSize.LETTER)
        repo.finalizeDraft(doc.id, "Passport")
        val saved = repo.getDocument(doc.id)!!
        assertFalse(saved.isDraft)
        assertEquals("Passport", saved.name)
        assertEquals(PdfPageSize.LETTER, saved.pageSize)
    }

    @Test
    fun `deleting a document removes pages and files`() = runBlocking {
        val id = docWithPages("a", "b")
        val dir = files.documentDir(id)
        assertTrue(dir.exists())
        repo.deleteDocument(id)
        assertNull(repo.getDocument(id))
        assertTrue(repo.getPages(id).isEmpty())
        assertFalse(dir.exists())
    }

    @Test
    fun `library lists newest first with cover and page count`() = runBlocking {
        val first = docWithPages("a1", "a2")
        repo.finalizeDraft(first)
        val second = docWithPages("b1")
        repo.finalizeDraft(second)
        repo.rename(first, "Touched last") // bumps updatedAt

        val library = repo.observeLibrary().first()
        assertEquals(listOf(first, second), library.map { it.document.id })
        assertEquals(2, library[0].pageCount)
        assertEquals("a1", library[0].cover!!.id)
        assertNotNull(library[1].cover)
    }

    @Test
    fun `page operations in one document do not touch another`() = runBlocking {
        val a = docWithPages("a1", "a2")
        val b = docWithPages("b1", "b2")
        repo.movePage(a, "a2", 0)
        repo.removePage("b1")
        assertEquals(listOf("a2", "a1"), repo.getPages(a).map { it.id })
        assertEquals(listOf("b2"), repo.getPages(b).map { it.id })
    }
}
