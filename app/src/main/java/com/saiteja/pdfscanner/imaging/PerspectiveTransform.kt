package com.saiteja.pdfscanner.imaging

import com.saiteja.pdfscanner.domain.Quad
import com.saiteja.pdfscanner.domain.distance
import kotlin.math.max
import kotlin.math.roundToInt

/** Perspective ("keystone") correction implemented on raw ARGB pixel arrays. */
object PerspectiveTransform {

    /** Output size that preserves the quad's resolution but never exceeds [maxSide] on either edge. */
    fun outputSize(quadPx: Quad, maxSide: Int): Pair<Int, Int> {
        val w = max(distance(quadPx.tl, quadPx.tr), distance(quadPx.bl, quadPx.br))
        val h = max(distance(quadPx.tl, quadPx.bl), distance(quadPx.tr, quadPx.br))
        val scale = minOf(1f, maxSide / max(w, h).coerceAtLeast(1f))
        return Pair((w * scale).roundToInt().coerceAtLeast(1), (h * scale).roundToInt().coerceAtLeast(1))
    }

    /**
     * Homography (3x3, row-major, h22 = 1) mapping destination coordinates in
     * [0,[dstW]]x[0,[dstH]] onto the source [quad] (pixel coordinates).
     */
    fun homography(dstW: Double, dstH: Double, quad: Quad): DoubleArray {
        val us = doubleArrayOf(0.0, dstW, dstW, 0.0)
        val vs = doubleArrayOf(0.0, 0.0, dstH, dstH)
        val xs = quad.points.map { it.x.toDouble() }
        val ys = quad.points.map { it.y.toDouble() }
        val a = Array(8) { DoubleArray(9) }
        for (i in 0 until 4) {
            val u = us[i]; val v = vs[i]; val x = xs[i]; val y = ys[i]
            a[2 * i] = doubleArrayOf(u, v, 1.0, 0.0, 0.0, 0.0, -u * x, -v * x, x)
            a[2 * i + 1] = doubleArrayOf(0.0, 0.0, 0.0, u, v, 1.0, -u * y, -v * y, y)
        }
        val sol = solve(a)
        return doubleArrayOf(sol[0], sol[1], sol[2], sol[3], sol[4], sol[5], sol[6], sol[7], 1.0)
    }

    /** Gaussian elimination with partial pivoting on an augmented 8x9 matrix. */
    private fun solve(a: Array<DoubleArray>): DoubleArray {
        val n = 8
        for (col in 0 until n) {
            var pivot = col
            for (r in col + 1 until n) if (kotlin.math.abs(a[r][col]) > kotlin.math.abs(a[pivot][col])) pivot = r
            val tmp = a[col]; a[col] = a[pivot]; a[pivot] = tmp
            val p = a[col][col]
            require(kotlin.math.abs(p) > 1e-12) { "Degenerate quadrilateral" }
            for (c in col until n + 1) a[col][c] /= p
            for (r in 0 until n) {
                if (r == col) continue
                val f = a[r][col]
                if (f == 0.0) continue
                for (c in col until n + 1) a[r][c] -= f * a[col][c]
            }
        }
        return DoubleArray(n) { a[it][n] }
    }

    /**
     * Warps the region of [src] bounded by [quadPx] (pixel coordinates) into a new [outW]x[outH]
     * ARGB array using bilinear sampling.
     */
    fun warp(src: IntArray, srcW: Int, srcH: Int, quadPx: Quad, outW: Int, outH: Int): IntArray {
        val hm = homography(outW.toDouble(), outH.toDouble(), quadPx)
        val out = IntArray(outW * outH)
        for (oy in 0 until outH) {
            val v = oy + 0.5
            for (ox in 0 until outW) {
                val u = ox + 0.5
                val d = hm[6] * u + hm[7] * v + 1.0
                val sx = (hm[0] * u + hm[1] * v + hm[2]) / d - 0.5
                val sy = (hm[3] * u + hm[4] * v + hm[5]) / d - 0.5
                out[oy * outW + ox] = bilinear(src, srcW, srcH, sx, sy)
            }
        }
        return out
    }

    private fun bilinear(src: IntArray, w: Int, h: Int, x: Double, y: Double): Int {
        val cx = x.coerceIn(0.0, (w - 1).toDouble())
        val cy = y.coerceIn(0.0, (h - 1).toDouble())
        val x0 = cx.toInt()
        val y0 = cy.toInt()
        val x1 = minOf(x0 + 1, w - 1)
        val y1 = minOf(y0 + 1, h - 1)
        val fx = ((cx - x0) * 256).toInt()
        val fy = ((cy - y0) * 256).toInt()
        val p00 = src[y0 * w + x0]; val p10 = src[y0 * w + x1]
        val p01 = src[y1 * w + x0]; val p11 = src[y1 * w + x1]
        var result = 0xFF shl 24
        for (shift in intArrayOf(16, 8, 0)) {
            val top = ((p00 shr shift) and 0xFF) * (256 - fx) + ((p10 shr shift) and 0xFF) * fx
            val bottom = ((p01 shr shift) and 0xFF) * (256 - fx) + ((p11 shr shift) and 0xFF) * fx
            val value = (top * (256 - fy) + bottom * fy) shr 16
            result = result or (value.coerceIn(0, 255) shl shift)
        }
        return result
    }
}
