package com.saiteja.pdfscanner.pdf

import com.saiteja.pdfscanner.domain.PdfPageSize
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.ByteArrayOutputStream
import kotlin.random.Random
import java.time.ZoneOffset
import java.time.ZonedDateTime

class PdfWriterTest {

    /** Stand-in for an encoded JPEG: SOI/EOI framing around binary noise (the writer never decodes it). */
    private fun jpeg(w: Int, h: Int, seed: Int): PdfImage {
        val payload = Random(seed).nextBytes(2000 + seed)
        val bytes = byteArrayOf(0xFF.toByte(), 0xD8.toByte()) + payload + byteArrayOf(0xFF.toByte(), 0xD9.toByte())
        return PdfImage(bytes, w, h)
    }

    private fun build(size: PdfPageSize, images: List<PdfImage>, title: String = "Test"): ByteArray {
        val out = ByteArrayOutputStream()
        PdfWriter.write(out, images.size, size, title, created = ZonedDateTime.of(2026, 1, 2, 3, 4, 5, 0, ZoneOffset.UTC)) { images[it] }
        return out.toByteArray()
    }

    private fun text(bytes: ByteArray) = String(bytes, Charsets.ISO_8859_1)

    @Test
    fun `produces a structurally valid multipage pdf`() {
        val bytes = build(PdfPageSize.A4, listOf(jpeg(300, 400, 28), jpeg(400, 300, 42), jpeg(200, 200, 50)))
        val s = text(bytes)

        assertTrue(s.startsWith("%PDF-1.4\n"))
        assertTrue(s.endsWith("%%EOF\n"))
        assertEquals(3, Regex("/Type /Page /Parent").findAll(s).count())
        assertTrue(s.contains("/Type /Pages /Count 3"))

        // startxref must point at the xref table, and every entry must point at "<n> 0 obj".
        val startXref = Regex("startxref\n(\\d+)\n").find(s)!!.groupValues[1].toInt()
        assertTrue(s.substring(startXref).startsWith("xref\n0 "))
        val size = Regex("xref\n0 (\\d+)\n").find(s, startXref)!!.groupValues[1].toInt()
        assertEquals(1 + 3 + 3 * 3, size) // free entry + catalog/pages/info + 3 objects per page
        val entries = Regex("(\\d{10}) 00000 n \n").findAll(s.substring(startXref)).map { it.groupValues[1].toInt() }.toList()
        assertEquals(size - 1, entries.size)
        entries.forEachIndexed { i, offset ->
            assertTrue("object ${i + 1} at $offset", s.startsWith("${i + 1} 0 obj\n", offset))
        }
    }

    @Test
    fun `embedded jpegs are intact and declared with correct dimensions and length`() {
        val images = listOf(jpeg(120, 80, 6), jpeg(64, 96, 40))
        val bytes = build(PdfPageSize.LETTER, images)
        val s = text(bytes)

        val dicts = Regex("/Width (\\d+) /Height (\\d+) /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length (\\d+) >>\nstream\n")
            .findAll(s).toList()
        assertEquals(2, dicts.size)
        dicts.forEachIndexed { i, m ->
            val (w, h, len) = m.destructured
            assertEquals(images[i].widthPx, w.toInt())
            assertEquals(images[i].heightPx, h.toInt())
            assertEquals(images[i].jpeg.size, len.toInt())
            val start = m.range.last + 1
            val embedded = bytes.copyOfRange(start, start + len.toInt())
            assertTrue(embedded.contentEquals(images[i].jpeg))
        }
        // stream must be terminated right after its declared length
        val first = dicts[0]
        assertEquals("\nendstream", s.substring(first.range.last + 1 + images[0].jpeg.size, first.range.last + 1 + images[0].jpeg.size + 10))
    }

    @Test
    fun `fixed page sizes use a4 and letter media boxes and follow image orientation`() {
        val a4 = text(build(PdfPageSize.A4, listOf(jpeg(100, 200, 23), jpeg(200, 100, 23))))
        val boxes = Regex("/MediaBox \\[0 0 ([\\d.]+) ([\\d.]+)]").findAll(a4).map { it.groupValues[1] to it.groupValues[2] }.toList()
        assertEquals(listOf("595.28" to "841.89", "841.89" to "595.28"), boxes)

        val letter = text(build(PdfPageSize.LETTER, listOf(jpeg(100, 200, 23))))
        assertTrue(letter.contains("/MediaBox [0 0 612.00 792.00]"))
    }

    @Test
    fun `match image sizes the page to the scan at 150 dpi`() {
        val s = text(build(PdfPageSize.MATCH_IMAGE, listOf(jpeg(1500, 750, 23))))
        assertTrue(s.contains("/MediaBox [0 0 720.00 360.00]"))
        assertTrue(s.contains("q 720.00 0 0 360.00 0.00 0.00 cm /Im0 Do Q"))
    }

    @Test
    fun `layout keeps aspect ratio and centres the image`() {
        val g = PdfWriter.layout(PdfPageSize.A4, 1000, 500) // landscape page 841.89 x 595.28
        assertEquals(841.89f, g.pageW, 0.01f)
        assertEquals(g.w / g.h, 2f, 0.001f)
        assertEquals((g.pageW - g.w) / 2f, g.x, 0.001f)
        assertEquals((g.pageH - g.h) / 2f, g.y, 0.001f)
        assertTrue(g.w <= g.pageW + 0.01f && g.h <= g.pageH + 0.01f)
    }

    @Test
    fun `title is stored as utf16 hex so non ascii and special characters are safe`() {
        val s = text(build(PdfPageSize.A4, listOf(jpeg(10, 10, 32)), title = "Café (2)"))
        val hex = Regex("/Title <FEFF([0-9A-F]+)>").find(s)!!.groupValues[1]
        val decoded = String(hex.chunked(2).map { it.toInt(16).toByte() }.toByteArray(), Charsets.UTF_16BE)
        assertEquals("Café (2)", decoded)
    }

    @Test
    fun `pages are requested lazily one at a time and progress is reported`() {
        val requested = mutableListOf<Int>()
        val progress = mutableListOf<Pair<Int, Int>>()
        val image = jpeg(10, 10, 32)
        PdfWriter.write(ByteArrayOutputStream(), 3, PdfPageSize.A4, "t", onProgress = { d, t -> progress += d to t }) { requested += it; image }
        assertEquals(listOf(0, 1, 2), requested)
        assertEquals(listOf(1 to 3, 2 to 3, 3 to 3), progress)
    }

    @Test(expected = IllegalArgumentException::class)
    fun `refuses to write an empty document`() {
        PdfWriter.write(ByteArrayOutputStream(), 0, PdfPageSize.A4, "t") { error("unused") }
    }
}
