package com.saiteja.pdfscanner.imaging

import com.saiteja.pdfscanner.domain.Pt
import com.saiteja.pdfscanner.domain.Quad
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.abs
import kotlin.math.roundToInt
import kotlin.random.Random

/** Harder, photo-like synthetic scenes: texture, shadows, perspective, clutter, low contrast. */
class EdgeDetectorHardScenesTest {
    private val w = 320
    private val h = 420

    private class Scene(val argb: IntArray) {
        fun gray(): IntArray = IntArray(argb.size) {
            val p = argb[it]; (((p shr 16) and 255) * 299 + ((p shr 8) and 255) * 587 + (p and 255) * 114) / 1000
        }
    }

    private fun rgb(r: Int, g: Int, b: Int) = (0xFF shl 24) or (r.coerceIn(0, 255) shl 16) or (g.coerceIn(0, 255) shl 8) or b.coerceIn(0, 255)

    private fun inside(q: List<Pt>, x: Float, y: Float): Boolean {
        var sign = 0
        for (i in 0 until 4) {
            val a = q[i]; val b = q[(i + 1) % 4]
            val cross = (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x)
            val s = if (cross >= 0) 1 else -1
            if (sign == 0) sign = s else if (s != sign) return false
        }
        return true
    }

    /**
     * Background: smooth blotchy texture + noise. Page: [paper] colour with text lines, a diagonal
     * shadow gradient and noise. [clutter] adds an overlapping blue card and a darker folder strip.
     */
    private fun scene(
        page: List<Pt>,
        bg: Triple<Int, Int, Int>,
        paper: Triple<Int, Int, Int>,
        bgTexture: Int = 18,
        shadow: Int = 25,
        clutter: Boolean = false,
        seed: Int = 1,
    ): Scene {
        val rnd = Random(seed)
        val blotch = FloatArray(w * h)
        // low-frequency texture from a coarse random grid, bilinearly upsampled
        val gw = 12; val gh = 16
        val grid = FloatArray((gw + 1) * (gh + 1)) { rnd.nextFloat() - 0.5f }
        for (y in 0 until h) for (x in 0 until w) {
            val gx = x * gw / w.toFloat(); val gy = y * gh / h.toFloat()
            val x0 = gx.toInt(); val y0 = gy.toInt(); val fx = gx - x0; val fy = gy - y0
            val v = grid[y0 * (gw + 1) + x0] * (1 - fx) * (1 - fy) + grid[y0 * (gw + 1) + x0 + 1] * fx * (1 - fy) +
                grid[(y0 + 1) * (gw + 1) + x0] * (1 - fx) * fy + grid[(y0 + 1) * (gw + 1) + x0 + 1] * fx * fy
            blotch[y * w + x] = v
        }
        val px = IntArray(w * h)
        val card = listOf(Pt(20f, 60f), Pt(150f, 40f), Pt(160f, 130f), Pt(30f, 150f))
        for (y in 0 until h) for (x in 0 until w) {
            val i = y * w + x
            val noise = rnd.nextInt(-4, 5)
            var (r, g, b) = Triple(bg.first, bg.second, bg.third)
            val t = (blotch[i] * 2 * bgTexture).roundToInt()
            r += t + noise; g += t + noise; b += t + noise
            if (clutter && y in 10 until 50) { r -= 40; g -= 40; b -= 30 }
            if (clutter && inside(card, x + 0.5f, y + 0.5f)) { r = 30; g = 60; b = 160 }
            if (inside(page, x + 0.5f, y + 0.5f)) {
                val lit = -shadow * ((x + y) / (w + h).toFloat())
                r = paper.first + lit.roundToInt() + noise; g = paper.second + lit.roundToInt() + noise; b = paper.third + lit.roundToInt() + noise
                val minX = page.minOf { it.x }; val minY = page.minOf { it.y }; val maxX = page.maxOf { it.x }
                val rel = (y - minY).toInt() % 16
                if (rel in 6..9 && x > minX + 30 && x < maxX - 30 && y > minY + 30) { r = 60; g = 60; b = 70 }
            }
            px[i] = rgb(r, g, b)
        }
        return Scene(px)
    }

    private fun assertCorners(expected: List<Pt>, actual: Quad, tol: Float = 0.045f) {
        expected.zip(actual.points).forEachIndexed { i, (e, a) ->
            assertEquals("corner $i x", e.x / w, a.x, tol)
            assertEquals("corner $i y", e.y / h, a.y, tol)
        }
    }

    private val perspectivePage = listOf(Pt(60f, 55f), Pt(265f, 80f), Pt(285f, 365f), Pt(40f, 385f))

    @Test
    fun `textured background with shadow and perspective`() {
        val s = scene(perspectivePage, Triple(110, 100, 95), Triple(225, 222, 212))
        val q = EdgeDetector.detectArgb(s.argb, w, h)
        assertNotNull(q)
        assertCorners(perspectivePage, q!!)
    }

    @Test
    fun `clutter behind the page - folder strip and blue card`() {
        val s = scene(perspectivePage, Triple(150, 140, 130), Triple(235, 235, 228), clutter = true, seed = 3)
        val q = EdgeDetector.detectArgb(s.argb, w, h)
        assertNotNull(q)
        assertCorners(perspectivePage, q!!, tol = 0.06f)
    }

    @Test
    fun `low contrast page`() {
        val s = scene(perspectivePage, Triple(165, 160, 155), Triple(205, 202, 196), bgTexture = 8, shadow = 10, seed = 5)
        val q = EdgeDetector.detectArgb(s.argb, w, h)
        assertNotNull(q)
        assertCorners(perspectivePage, q!!, tol = 0.06f)
    }

    @Test
    fun `page differs from background only in colour not brightness`() {
        val s = scene(perspectivePage, Triple(200, 140, 100), Triple(140, 150, 200), bgTexture = 4, shadow = 0, seed = 9)
        val q = EdgeDetector.detectArgb(s.argb, w, h)
        assertNotNull("colour edges must be seen", q)
        assertCorners(perspectivePage, q!!, tol = 0.06f)
    }

    @Test
    fun `rotated page`() {
        val rot = listOf(Pt(110f, 30f), Pt(290f, 120f), Pt(215f, 390f), Pt(35f, 300f))
        val s = scene(rot, Triple(95, 95, 100), Triple(230, 230, 225), seed = 11)
        val q = EdgeDetector.detectArgb(s.argb, w, h)
        assertNotNull(q)
        assertCorners(rot, q!!, tol = 0.06f)
    }

    @Test
    fun `page cut off by the right edge of the frame keeps clamped corners`() {
        val cut = listOf(Pt(50f, 60f), Pt(360f, 60f), Pt(360f, 370f), Pt(50f, 370f)) // extends past x = 320
        val s = scene(cut, Triple(100, 95, 90), Triple(228, 226, 218), seed = 13)
        val q = EdgeDetector.detectArgb(s.argb, w, h)
        assertNotNull(q)
        val expected = listOf(Pt(50f, 60f), Pt(w.toFloat(), 60f), Pt(w.toFloat(), 370f), Pt(50f, 370f))
        assertCorners(expected, q!!, tol = 0.05f)
    }

    @Test
    fun `grayscale entry point agrees on a clear scene`() {
        val s = scene(perspectivePage, Triple(90, 90, 90), Triple(230, 230, 230), seed = 2)
        val q = EdgeDetector.detect(s.gray(), w, h)
        assertNotNull(q)
        assertCorners(perspectivePage, q!!)
    }

    @Test
    fun `texture only is not mistaken for a document`() {
        val s = scene(emptyList<Pt>().let { listOf(Pt(0f, 0f), Pt(0f, 0f), Pt(0f, 0f), Pt(0f, 0f)) }, Triple(120, 110, 100), Triple(0, 0, 0), bgTexture = 30, seed = 4)
        assertNull(EdgeDetector.detectArgb(s.argb, w, h))
    }

    @Test
    fun `a page filling the whole frame returns null so the full image is kept`() {
        val full = listOf(Pt(0f, 0f), Pt(w.toFloat(), 0f), Pt(w.toFloat(), h.toFloat()), Pt(0f, h.toFloat()))
        val s = scene(full, Triple(0, 0, 0), Triple(230, 230, 225), seed = 6)
        assertNull(EdgeDetector.detectArgb(s.argb, w, h))
    }

    @Test
    fun `detection is reasonably fast`() {
        val s = scene(perspectivePage, Triple(110, 100, 95), Triple(225, 222, 212))
        val start = System.nanoTime()
        repeat(3) { EdgeDetector.detectArgb(s.argb, w, h) }
        val ms = (System.nanoTime() - start) / 3_000_000
        assertTrue("took $ms ms per run", ms < 1500)
    }
}
