package com.saiteja.pdfscanner.imaging

import kotlin.math.abs
import kotlin.math.sqrt

/**
 * Canny edge detector: blur, Sobel gradient (strongest of the colour channels, so a page that
 * differs from the desk only in hue is still seen), non-maximum suppression, then hysteresis
 * thresholding with thresholds derived from the image itself.
 */
internal object CannyEdges {
    private const val TAN_22_5 = 0.4142f
    private const val TAN_67_5 = 2.4142f
    private const val MIN_HIGH_THRESHOLD = 30f

    fun detect(channels: List<IntArray>, w: Int, h: Int): BooleanArray {
        val n = w * h
        val blurred = channels.map { BoxBlur.apply(it, w, h, 1, passes = 2) }
        val mag = FloatArray(n)
        val gxs = IntArray(n)
        val gys = IntArray(n)
        for (y in 1 until h - 1) {
            for (x in 1 until w - 1) {
                val i = y * w + x
                var best = 0
                var bx = 0
                var by = 0
                for (c in blurred) {
                    val gx = -c[i - w - 1] + c[i - w + 1] - 2 * c[i - 1] + 2 * c[i + 1] - c[i + w - 1] + c[i + w + 1]
                    val gy = -c[i - w - 1] - 2 * c[i - w] - c[i - w + 1] + c[i + w - 1] + 2 * c[i + w] + c[i + w + 1]
                    val m = gx * gx + gy * gy
                    if (m > best) { best = m; bx = gx; by = gy }
                }
                mag[i] = sqrt(best.toFloat())
                gxs[i] = bx
                gys[i] = by
            }
        }

        val nms = FloatArray(n)
        val survivors = ArrayList<Float>()
        for (y in 1 until h - 1) {
            for (x in 1 until w - 1) {
                val i = y * w + x
                val m = mag[i]
                if (m == 0f) continue
                val ax = abs(gxs[i])
                val ay = abs(gys[i])
                val (a, b) = when {
                    ay <= ax * TAN_22_5 -> (i - 1) to (i + 1)
                    ay >= ax * TAN_67_5 -> (i - w) to (i + w)
                    (gxs[i] > 0) == (gys[i] > 0) -> (i - w - 1) to (i + w + 1)
                    else -> (i - w + 1) to (i + w - 1)
                }
                if (m >= mag[a] && m >= mag[b]) { nms[i] = m; survivors += m }
            }
        }
        if (survivors.isEmpty()) return BooleanArray(n)
        survivors.sort()
        val high = maxOf(MIN_HIGH_THRESHOLD, survivors[(survivors.size * 0.60f).toInt().coerceAtMost(survivors.size - 1)])
        val low = high * 0.5f

        val edges = BooleanArray(n)
        val stack = IntArray(n)
        var sp = 0
        for (i in 0 until n) if (nms[i] >= high) { edges[i] = true; stack[sp++] = i }
        while (sp > 0) {
            val i = stack[--sp]
            val x = i % w
            val y = i / w
            for (dy in -1..1) for (dx in -1..1) {
                if (dx == 0 && dy == 0) continue
                val nx = x + dx
                val ny = y + dy
                if (nx < 1 || ny < 1 || nx >= w - 1 || ny >= h - 1) continue
                val j = ny * w + nx
                if (!edges[j] && nms[j] >= low) { edges[j] = true; stack[sp++] = j }
            }
        }
        return edges
    }
}
