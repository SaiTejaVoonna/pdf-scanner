package com.saiteja.pdfscanner.imaging

import com.saiteja.pdfscanner.domain.FileNames
import com.saiteja.pdfscanner.domain.ImageFormat
import com.saiteja.pdfscanner.domain.ImageSizing
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class EnhanceFilterTest {
    private fun rgb(r: Int, g: Int, b: Int) = (0xFF shl 24) or (r shl 16) or (g shl 8) or b
    private fun r(p: Int) = (p shr 16) and 255
    private fun g(p: Int) = (p shr 8) and 255
    private fun b(p: Int) = p and 255

    /** Paper that falls from bright (left) to a deep shadow (right), with dark and blue ink. */
    private fun shadowedPage(w: Int, h: Int): IntArray {
        val px = IntArray(w * h) { i ->
            val x = i % w
            val paper = 245 - x * 125 / w
            rgb(paper, paper, paper - 8)
        }
        for (y in 40 until 44) for (x in 20 until w - 20) px[y * w + x] = rgb(25, 25, 30)                // black ink line
        for (y in 90 until 94) for (x in 20 until w - 20) px[y * w + x] = rgb(25, 40, 170)              // blue ink line
        return px
    }

    @Test
    fun `removes the shadow gradient so paper is white everywhere`() {
        val w = 256; val h = 160
        val px = shadowedPage(w, h)
        ImageFilters.enhance(px, w, h)
        for (x in listOf(2, 60, 128, 200, 253)) {
            val p = px[10 * w + x]
            // The test shadow is harsh (brightness halves across the page); the far edge is the worst case.
            // Blue stays a little lower on purpose: the paper itself has a slight warm tint that is preserved.
            assertTrue("paper at x=$x was ${r(p)},${g(p)},${b(p)}", r(p) >= 228 && g(p) >= 228 && b(p) >= 205)
        }
    }

    @Test
    fun `keeps ink dark and keeps its colour`() {
        val w = 256; val h = 160
        val px = shadowedPage(w, h)
        ImageFilters.enhance(px, w, h)
        for (x in listOf(40, 128, 230)) {
            assertTrue("black ink at $x", r(px[41 * w + x]) < 70)
            val blue = px[91 * w + x]
            assertTrue("blue ink at $x was ${r(blue)},${g(blue)},${b(blue)}", b(blue) > r(blue) + 60 && r(blue) < 90)
        }
    }

    @Test
    fun `is a no-op safe on tiny and flat images`() {
        val tiny = intArrayOf(rgb(10, 20, 30))
        ImageFilters.enhance(tiny, 1, 1)
        assertEquals(1, tiny.size)
        val flat = IntArray(64 * 64) { rgb(200, 200, 200) }
        ImageFilters.enhance(flat, 64, 64)
        assertTrue(flat.all { r(it) >= 250 })
        val dark = IntArray(64 * 64) { rgb(5, 5, 5) }
        ImageFilters.enhance(dark, 64, 64)
        assertTrue("near-black must not be blown up into noise", dark.all { r(it) < 60 })
    }

    @Test
    fun `fast enough for a full size page`() {
        val w = 1600; val h = 2200
        val px = IntArray(w * h) { rgb(200, 200, 190) }
        val start = System.nanoTime()
        ImageFilters.enhance(px, w, h)
        val ms = (System.nanoTime() - start) / 1_000_000
        assertTrue("took $ms ms", ms < 4000)
    }
}

class BoxBlurTest {
    @Test
    fun `blur of a constant image is constant and matches a naive average`() {
        val w = 9; val h = 7
        val flat = IntArray(w * h) { 100 }
        assertTrue(BoxBlur.apply(flat, w, h, 2).all { it == 100 })
        val src = IntArray(w * h) { (it * 37) % 251 }
        val out = BoxBlur.apply(src, w, h, 1)
        // Compare one interior pixel with a manual separable average (horizontal then vertical, integer division).
        val tmp = IntArray(w * h)
        for (y in 0 until h) for (x in 0 until w) {
            var s = 0; var n = 0
            for (k in -1..1) if (x + k in 0 until w) { s += src[y * w + x + k]; n++ }
            tmp[y * w + x] = s / n
        }
        var s = 0; var n = 0
        for (k in -1..1) { s += tmp[(3 + k) * w + 4]; n++ }
        assertEquals(s / n, out[3 * w + 4])
    }
}

class ImageSizingTest {
    @Test fun `fitWithin scales down keeping aspect and never enlarges`() {
        assertEquals(2000 to 1000, ImageSizing.fitWithin(4000, 2000, 2000))
        assertEquals(750 to 1000, ImageSizing.fitWithin(1500, 2000, 1000))
        assertEquals(800 to 600, ImageSizing.fitWithin(800, 600, 2048))
        assertEquals(4000 to 3000, ImageSizing.fitWithin(4000, 3000, null))
        assertEquals(1 to 800, ImageSizing.fitWithin(1, 4000, 800))
    }

    @Test fun `output names are sanitized and unique within a batch`() {
        val taken = mutableSetOf<String>()
        assertEquals("IMG_001-resized.jpg", ImageSizing.outputName("IMG_001.JPG", ImageFormat.JPEG, taken))
        assertEquals("IMG_001-resized (2).jpg", ImageSizing.outputName("IMG_001.png", ImageFormat.JPEG, taken))
        assertEquals("img_001-resized (3).jpg", ImageSizing.outputName("img_001.jpeg", ImageFormat.JPEG, taken))
        assertEquals("IMG_001-resized.png", ImageSizing.outputName("IMG_001.jpg", ImageFormat.PNG, taken))
        assertEquals("a b-resized.jpg", ImageSizing.outputName("a/b.jpg", ImageFormat.JPEG, taken))
        assertEquals("image-resized.jpg", ImageSizing.outputName(null, ImageFormat.JPEG, taken))
        assertEquals("image-resized (2).jpg", ImageSizing.outputName("", ImageFormat.JPEG, taken))
        assertEquals("Scan", FileNames.sanitize(""))
    }

    @Test fun `byte formatting`() {
        assertEquals("512 B", ImageSizing.formatBytes(512))
        assertEquals("2 KB", ImageSizing.formatBytes(2048))
        assertEquals("1.5 MB", ImageSizing.formatBytes(1_572_864))
        assertNotEquals("0 B", ImageSizing.formatBytes(1))
    }

    @Test fun `pdf page render size targets 200 dpi and is capped`() {
        // A4 is 595x842 pt -> at 200 dpi about 1653x2339 px
        val (w, h) = PdfPageImporter.targetSize(595, 842)
        assertEquals(1652.0, w.toDouble(), 3.0); assertEquals(2338.0, h.toDouble(), 3.0)
        val (bw, bh) = PdfPageImporter.targetSize(3000, 4000) // huge poster page is capped at 2400 on the long side
        assertEquals(2400, bh); assertEquals(1800, bw)
        val (sw, sh) = PdfPageImporter.targetSize(0, 0)
        assertTrue(sw >= 1 && sh >= 1)
    }
}
