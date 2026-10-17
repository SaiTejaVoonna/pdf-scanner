package com.saiteja.pdfscanner.imaging

import com.saiteja.pdfscanner.domain.PageFilter
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ImageFiltersTest {
    private fun rgb(r: Int, g: Int, b: Int) = (0xFF shl 24) or (r shl 16) or (g shl 8) or b
    private val white = 0xFFFFFFFF.toInt()
    private val black = 0xFF000000.toInt()

    @Test
    fun `original leaves pixels untouched`() {
        val px = IntArray(16) { rgb(it * 10, 255 - it, it) }
        val copy = px.copyOf()
        ImageFilters.apply(px, 4, 4, PageFilter.ORIGINAL)
        assertTrue(px.contentEquals(copy))
    }

    @Test
    fun `grayscale makes channels equal using luma weights`() {
        val px = intArrayOf(rgb(255, 0, 0), rgb(0, 255, 0), rgb(0, 0, 255), rgb(10, 20, 30))
        ImageFilters.grayscale(px)
        px.forEach { p ->
            assertEquals((p shr 16) and 0xFF, (p shr 8) and 0xFF)
            assertEquals((p shr 8) and 0xFF, p and 0xFF)
            assertEquals(0xFF, p ushr 24)
        }
        assertEquals(76, px[0] and 0xFF)   // 0.299 * 255
        assertEquals(149, px[1] and 0xFF)  // 0.587 * 255
        assertEquals(29, px[2] and 0xFF)   // 0.114 * 255
    }

    @Test
    fun `black and white yields only black or white and keeps blank paper white`() {
        val w = 64; val h = 64
        val px = IntArray(w * h) { rgb(200, 200, 190) }
        // a dark "stroke"
        for (y in 20 until 24) for (x in 8 until 56) px[y * w + x] = rgb(40, 40, 40)
        ImageFilters.blackAndWhite(px, w, h)
        assertTrue(px.all { it == white || it == black })
        assertEquals(black, px[21 * w + 30])
        assertEquals(white, px[5 * w + 5])
        assertEquals(white, px[50 * w + 50])
    }

    @Test
    fun `black and white handles uneven lighting that defeats a global threshold`() {
        val w = 120; val h = 60
        // Paper brightness falls from 240 (left) to 110 (right); text is ~45% darker than local paper.
        val px = IntArray(w * h) { i ->
            val x = i % w
            val paper = 240 - x * 130 / w
            rgb(paper, paper, paper)
        }
        val textCols = listOf(10, 60, 110)
        for (cx in textCols) for (y in 20 until 40) for (x in cx until cx + 3) {
            val paper = 240 - x * 130 / w
            val v = paper * 55 / 100
            px[y * w + x] = rgb(v, v, v)
        }
        ImageFilters.blackAndWhite(px, w, h)
        for (cx in textCols) assertEquals("text at $cx", black, px[30 * w + cx + 1])
        // Paper on the dim right side must still come out white (a global threshold would blacken it).
        assertEquals(white, px[10 * w + 100])
        assertEquals(white, px[10 * w + 5])
    }
}
