package com.saiteja.pdfscanner.imaging

import com.saiteja.pdfscanner.domain.Pt
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.random.Random

class EdgeDetectorTest {
    private val w = 200
    private val h = 280

    private fun scene(background: Int, paper: Int, noise: Int = 0, block: (Int, Int) -> Boolean): IntArray {
        val rnd = Random(7)
        return IntArray(w * h) { i ->
            val x = i % w; val y = i / w
            val base = if (block(x, y)) paper else background
            (base + if (noise > 0) rnd.nextInt(-noise, noise + 1) else 0).coerceIn(0, 255)
        }
    }

    private fun assertCorner(expected: Pt, actual: Pt, tolPx: Float = 6f) {
        assertEquals("x", expected.x, actual.x * w, tolPx)
        assertEquals("y", expected.y, actual.y * h, tolPx)
    }

    @Test
    fun `finds an axis aligned bright page on a dark desk`() {
        val gray = scene(background = 40, paper = 220, noise = 6) { x, y -> x in 30 until 170 && y in 40 until 250 }
        val quad = EdgeDetector.detect(gray, w, h)
        assertNotNull(quad)
        assertCorner(Pt(30f, 40f), quad!!.tl)
        assertCorner(Pt(170f, 40f), quad.tr)
        assertCorner(Pt(170f, 250f), quad.br)
        assertCorner(Pt(30f, 250f), quad.bl)
    }

    @Test
    fun `ignores printed text inside the page`() {
        val gray = scene(background = 30, paper = 230, noise = 4) { x, y ->
            val onPage = x in 25 until 175 && y in 35 until 245
            // dark text lines inside the page
            val text = onPage && (y - 35) % 14 in 4..7 && x in 40 until 160
            onPage && !text
        }
        val quad = EdgeDetector.detect(gray, w, h)
        assertNotNull(quad)
        assertCorner(Pt(25f, 35f), quad!!.tl)
        assertCorner(Pt(175f, 245f), quad.br)
    }

    @Test
    fun `finds a rotated page and orders corners clockwise from top left`() {
        // Parallelogram-ish page rotated ~12 degrees.
        val corners = listOf(Pt(45f, 30f), Pt(165f, 50f), Pt(150f, 240f), Pt(30f, 222f))
        val gray = scene(background = 50, paper = 210, noise = 3) { x, y -> pointInQuad(corners, x + 0.5f, y + 0.5f) }
        val quad = EdgeDetector.detect(gray, w, h)
        assertNotNull(quad)
        assertTrue(quad!!.isConvex())
        corners.zip(quad.points).forEach { (e, a) -> assertCorner(e, a, tolPx = 9f) }
    }

    @Test
    fun `finds a dark page on a bright table`() {
        val gray = scene(background = 235, paper = 60, noise = 4) { x, y -> x in 40 until 160 && y in 50 until 230 }
        val quad = EdgeDetector.detect(gray, w, h)
        assertNotNull(quad)
        assertCorner(Pt(40f, 50f), quad!!.tl)
        assertCorner(Pt(160f, 230f), quad.br)
    }

    @Test
    fun `returns null when there is no document like shape`() {
        assertNull(EdgeDetector.detect(IntArray(w * h) { 128 }, w, h))
        val rnd = Random(3)
        assertNull(EdgeDetector.detect(IntArray(w * h) { rnd.nextInt(0, 256) }, w, h))
    }

    @Test
    fun `rejects tiny or invalid input without throwing`() {
        assertNull(EdgeDetector.detect(IntArray(4), 2, 2))
        assertNull(EdgeDetector.detect(IntArray(10), 100, 100))
    }

    private fun pointInQuad(q: List<Pt>, x: Float, y: Float): Boolean {
        var sign = 0
        for (i in 0 until 4) {
            val a = q[i]; val b = q[(i + 1) % 4]
            val cross = (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x)
            val s = if (cross >= 0) 1 else -1
            if (sign == 0) sign = s else if (s != sign) return false
        }
        return true
    }
}
