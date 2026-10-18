package com.saiteja.pdfscanner.pdf

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Color
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.saiteja.pdfscanner.data.AppDatabase
import com.saiteja.pdfscanner.data.DocumentRepository
import com.saiteja.pdfscanner.data.FileStore
import com.saiteja.pdfscanner.domain.PageFilter
import com.saiteja.pdfscanner.domain.PdfPageSize
import com.saiteja.pdfscanner.domain.Pt
import com.saiteja.pdfscanner.domain.Quad
import com.saiteja.pdfscanner.imaging.PageRenderer
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream

/** End-to-end: real bitmaps -> crop/filter/rotate -> JPEG -> multipage PDF. */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34])
class PdfExporterTest {
    private lateinit var db: AppDatabase
    private lateinit var files: FileStore
    private lateinit var repo: DocumentRepository
    private lateinit var exporter: PdfExporter
    private lateinit var renderer: PageRenderer

    @Before
    fun setUp() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        db = Room.inMemoryDatabaseBuilder(context, AppDatabase::class.java).allowMainThreadQueries().build()
        files = FileStore(context)
        repo = DocumentRepository(db, files)
        renderer = PageRenderer(files)
        exporter = PdfExporter(repo, renderer, files)
    }

    @After
    fun tearDown() {
        db.close()
    }

    /** A 400x300 image: blue desk with a red "page" in the middle, saved as a JPEG source. */
    private fun writeSource(docId: String, name: String, w: Int = 400, h: Int = 300) {
        val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        bmp.eraseColor(Color.BLUE)
        for (y in h / 4 until h * 3 / 4) for (x in w / 4 until w * 3 / 4) bmp.setPixel(x, y, Color.RED)
        FileOutputStream(files.pageFile(docId, name)).use { bmp.compress(Bitmap.CompressFormat.JPEG, 95, it) }
        bmp.recycle()
    }

    private suspend fun makeDocument(pages: Int): String {
        val doc = repo.createDraft("Export me")
        repeat(pages) { i ->
            writeSource(doc.id, "p$i.jpg")
            repo.addPage(doc.id, "p$i.jpg", pageId = "p$i")
        }
        return doc.id
    }

    @Test
    fun `exports every page into a valid pdf`() = runBlocking {
        val id = makeDocument(3)
        val out = ByteArrayOutputStream()
        val progress = mutableListOf<Int>()
        exporter.export(id, PdfPageSize.A4, "Export me", out) { done, _ -> progress += done }
        val s = String(out.toByteArray(), Charsets.ISO_8859_1)

        assertTrue(s.startsWith("%PDF-1.4"))
        assertTrue(s.trimEnd().endsWith("%%EOF"))
        assertEquals(3, Regex("/Type /Page /Parent").findAll(s).count())
        assertEquals(3, Regex("/Filter /DCTDecode").findAll(s).count())
        assertEquals(listOf(1, 2, 3), progress)
        // JPEG payloads begin with the SOI marker.
        val startMarkers = Regex("stream\nÿØ").findAll(s).count()
        assertEquals(3, startMarkers)
    }

    @Test
    fun `page order in the pdf follows the document order`() = runBlocking {
        val id = makeDocument(2)
        // Make page p1 a different size so its position is detectable in the output.
        writeSource(id, "p1.jpg", w = 200, h = 400)
        repo.movePage(id, "p1", 0)
        val out = ByteArrayOutputStream()
        exporter.export(id, PdfPageSize.MATCH_IMAGE, "t", out)
        val s = String(out.toByteArray(), Charsets.ISO_8859_1)
        val sizes = Regex("/Width (\\d+) /Height (\\d+)").findAll(s).map { it.groupValues[1].toInt() to it.groupValues[2].toInt() }.toList()
        assertEquals(listOf(200 to 400, 400 to 300), sizes)
    }

    @Test
    fun `crop rotation and filter are applied to exported pages`() = runBlocking {
        val id = makeDocument(1)
        val page = repo.getPage("p0")!!
        // Crop to the red square (inner half of the image) and rotate 90 degrees.
        val crop = Quad(Pt(0.25f, 0.25f), Pt(0.75f, 0.25f), Pt(0.75f, 0.75f), Pt(0.25f, 0.75f))
        repo.updatePage(page.copy(corners = crop, rotation = 90, filter = PageFilter.GRAYSCALE))
        val rendered = renderer.render(repo.getPage("p0")!!, 1000)
        // 200x150 crop rotated 90 degrees -> 150x200
        assertEquals(150, rendered.width)
        assertEquals(200, rendered.height)
        val p = rendered.getPixel(rendered.width / 2, rendered.height / 2)
        val r = Color.red(p); val g = Color.green(p); val b = Color.blue(p)
        assertTrue("grayscale pixel expected, was $r,$g,$b", r == g && g == b)
        // The crop contains only the red square: no blue desk may remain (blue luma is ~29, red ~76)
        for (y in 0 until rendered.height step 7) for (x in 0 until rendered.width step 7) {
            assertTrue("pixel at $x,$y too dark: ${Color.red(rendered.getPixel(x, y))}", Color.red(rendered.getPixel(x, y)) > 55)
        }
    }

    @Test
    fun `render caps the longest side`() {
        runBlocking {
            val id = makeDocument(1)
            val small = renderer.render(repo.getPage("p0")!!, 100)
            assertEquals(100, maxOf(small.width, small.height))
            assertTrue(id.isNotEmpty())
        }
    }

    @Test
    fun `exporting an empty document fails with a clear error`() = runBlocking {
        val doc = repo.createDraft("Empty")
        try {
            exporter.export(doc.id, PdfPageSize.A4, "Empty", ByteArrayOutputStream())
            throw AssertionError("expected ExportException")
        } catch (e: ExportException) {
            assertTrue(e.message!!.contains("no pages"))
        }
    }

    @Test
    fun `a missing page image surfaces as ExportException not a crash`() = runBlocking {
        val id = makeDocument(2)
        files.pageFile(id, "p1.jpg").delete()
        try {
            exporter.export(id, PdfPageSize.A4, "x", ByteArrayOutputStream())
            throw AssertionError("expected ExportException")
        } catch (e: ExportException) {
            // expected
        }
    }

    @Test
    fun `exportToCache writes a sanitized file and cleans up on failure`() = runBlocking {
        val id = makeDocument(1)
        val file: File = exporter.exportToCache(id, PdfPageSize.LETTER, "My: scan?")
        assertEquals("My scan.pdf", file.name)
        assertTrue(file.length() > 100)
        assertEquals(files.exportDir.canonicalPath, file.parentFile!!.canonicalPath)

        val empty = repo.createDraft("Empty")
        try {
            exporter.exportToCache(empty.id, PdfPageSize.A4, "Broken")
            throw AssertionError("expected failure")
        } catch (e: ExportException) {
            assertFalse(File(files.exportDir, "Broken.pdf").exists())
        }
    }

    @Test
    fun `successful export of a copy can be saved to a user chosen stream`() = runBlocking {
        val id = makeDocument(2)
        val target = File(files.captureDir, "user-chosen.pdf")
        target.outputStream().buffered().use { exporter.export(id, PdfPageSize.A4, "Chosen", it) }
        val text = target.readBytes().toString(Charsets.ISO_8859_1)
        assertTrue(text.startsWith("%PDF-"))
        assertTrue(text.contains("/Count 2"))
    }
}

@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34])
class PdfQualityTest {
    @Test
    fun `smaller quality presets produce smaller pdfs than high`() = runBlocking {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val db = Room.inMemoryDatabaseBuilder(context, AppDatabase::class.java).allowMainThreadQueries().build()
        val files = FileStore(context)
        val repo = DocumentRepository(db, files)
        val exporter = PdfExporter(repo, PageRenderer(files), files)
        val doc = repo.createDraft("q")
        // A busy 2600x3300 image so that resolution and JPEG quality both matter.
        val bmp = Bitmap.createBitmap(2600, 3300, Bitmap.Config.ARGB_8888)
        val rnd = java.util.Random(1)
        val row = IntArray(2600)
        for (y in 0 until 3300) {
            for (x in 0 until 2600) row[x] = Color.rgb((x * 7 + y * 3) % 256, rnd.nextInt(256), (x + y) % 256)
            bmp.setPixels(row, 0, 2600, 0, y, 2600, 1)
        }
        FileOutputStream(files.pageFile(doc.id, "p.jpg")).use { bmp.compress(Bitmap.CompressFormat.JPEG, 95, it) }
        bmp.recycle()
        repo.addPage(doc.id, "p.jpg", pageId = "p")

        fun size(q: com.saiteja.pdfscanner.domain.PdfQuality): Int {
            val out = ByteArrayOutputStream()
            runBlocking { exporter.export(doc.id, PdfPageSize.A4, "q", out, q) }
            return out.size()
        }
        val high = size(com.saiteja.pdfscanner.domain.PdfQuality.HIGH)
        val balanced = size(com.saiteja.pdfscanner.domain.PdfQuality.BALANCED)
        val small = size(com.saiteja.pdfscanner.domain.PdfQuality.SMALL)
        assertTrue("high=$high balanced=$balanced", balanced < high)
        assertTrue("balanced=$balanced small=$small", small < balanced)
        db.close()
    }
}
