package com.saiteja.pdfscanner.imaging

import com.saiteja.pdfscanner.domain.Pt
import com.saiteja.pdfscanner.domain.Quad
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PerspectiveTransformTest {

    private fun rgb(r: Int, g: Int, b: Int) = (0xFF shl 24) or (r shl 16) or (g shl 8) or b

    @Test
    fun `axis aligned quad is an exact crop`() {
        val w = 40; val h = 30
        val src = IntArray(w * h) { rgb((it % w) * 6, (it / w) * 8, 0) }
        val quad = Quad(Pt(10f, 5f), Pt(30f, 5f), Pt(30f, 25f), Pt(10f, 25f))
        val out = PerspectiveTransform.warp(src, w, h, quad, 20, 20)
        for (y in 0 until 20) for (x in 0 until 20) {
            assertEquals("pixel $x,$y", src[(y + 5) * w + (x + 10)], out[y * 20 + x])
        }
    }

    @Test
    fun `skewed quad of a uniform region rectifies to that colour`() {
        val w = 100; val h = 100
        val red = rgb(200, 30, 30)
        val src = IntArray(w * h) { rgb(0, 0, 255) }
        // Fill a trapezoid-ish (perspective) region with red.
        val quad = Quad(Pt(30f, 20f), Pt(70f, 25f), Pt(85f, 80f), Pt(15f, 75f))
        for (y in 0 until h) for (x in 0 until w) {
            if (inside(quad, x + 0.5f, y + 0.5f)) src[y * w + x] = red
        }
        // Sample slightly inside the quad to stay clear of anti-aliased boundary pixels.
        val inner = Quad(Pt(34f, 24f), Pt(67f, 28f), Pt(80f, 76f), Pt(20f, 72f))
        val out = PerspectiveTransform.warp(src, w, h, inner, 50, 70)
        assertTrue(out.all { it == red })
    }

    @Test
    fun `corners map to corners of the output`() {
        val quad = Quad(Pt(12f, 8f), Pt(90f, 15f), Pt(80f, 70f), Pt(5f, 60f))
        val h = PerspectiveTransform.homography(200.0, 100.0, quad)
        fun map(u: Double, v: Double): Pair<Double, Double> {
            val d = h[6] * u + h[7] * v + 1.0
            return ((h[0] * u + h[1] * v + h[2]) / d) to ((h[3] * u + h[4] * v + h[5]) / d)
        }
        val corners = listOf(0.0 to 0.0, 200.0 to 0.0, 200.0 to 100.0, 0.0 to 100.0)
        corners.zip(quad.points).forEach { (uv, p) ->
            val (x, y) = map(uv.first, uv.second)
            assertEquals(p.x.toDouble(), x, 1e-6)
            assertEquals(p.y.toDouble(), y, 1e-6)
        }
    }

    @Test
    fun `output size follows quad edges and respects the cap`() {
        val quad = Quad(Pt(0f, 0f), Pt(1000f, 0f), Pt(1000f, 500f), Pt(0f, 500f))
        assertEquals(1000 to 500, PerspectiveTransform.outputSize(quad, 4000))
        assertEquals(500 to 250, PerspectiveTransform.outputSize(quad, 500))
    }

    @Test(expected = IllegalArgumentException::class)
    fun `degenerate quad is rejected`() {
        PerspectiveTransform.homography(10.0, 10.0, Quad(Pt(1f, 1f), Pt(1f, 1f), Pt(1f, 1f), Pt(1f, 1f)))
    }

    private fun inside(q: Quad, x: Float, y: Float): Boolean {
        val p = q.points
        var sign = 0
        for (i in 0 until 4) {
            val a = p[i]; val b = p[(i + 1) % 4]
            val cross = (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x)
            val s = if (cross >= 0) 1 else -1
            if (sign == 0) sign = s else if (s != sign) return false
        }
        return true
    }
}
