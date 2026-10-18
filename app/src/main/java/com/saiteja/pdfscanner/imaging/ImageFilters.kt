package com.saiteja.pdfscanner.imaging

import com.saiteja.pdfscanner.domain.PageFilter

/** Pixel filters over ARGB arrays. All functions return a new array or modify in place as noted. */
object ImageFilters {

    private const val OPAQUE = 0xFF shl 24

    fun apply(pixels: IntArray, w: Int, h: Int, filter: PageFilter) {
        when (filter) {
            PageFilter.ORIGINAL -> Unit
            PageFilter.ENHANCED -> enhance(pixels, w, h)
            PageFilter.GRAYSCALE -> grayscale(pixels)
            PageFilter.BLACK_WHITE -> blackAndWhite(pixels, w, h)
        }
    }

    fun luma(argb: Int): Int {
        val r = (argb shr 16) and 0xFF
        val g = (argb shr 8) and 0xFF
        val b = argb and 0xFF
        return (r * 299 + g * 587 + b * 114) / 1000
    }

    fun grayscale(pixels: IntArray) {
        for (i in pixels.indices) {
            val l = luma(pixels[i])
            pixels[i] = OPAQUE or (l shl 16) or (l shl 8) or l
        }
    }

    /**
     * Adaptive (Bradley-Roth) threshold: a pixel turns black when it is clearly darker than the
     * average of its neighbourhood. This copes with uneven lighting and shadows that defeat a
     * single global threshold, and leaves blank paper white.
     */
    fun blackAndWhite(pixels: IntArray, w: Int, h: Int, sensitivity: Float = 0.12f) {
        val gray = IntArray(w * h) { luma(pixels[it]) }
        // Integral image. Sums may overflow Int for huge images, but window sums are small and
        // two's-complement wrap-around cancels out in the difference, so results stay exact.
        val integral = IntArray((w + 1) * (h + 1))
        for (y in 0 until h) {
            var rowSum = 0
            for (x in 0 until w) {
                rowSum += gray[y * w + x]
                integral[(y + 1) * (w + 1) + x + 1] = integral[y * (w + 1) + x + 1] + rowSum
            }
        }
        val radius = maxOf(8, minOf(w, h) / 16)
        val factor = 1f - sensitivity
        for (y in 0 until h) {
            val y0 = maxOf(0, y - radius)
            val y1 = minOf(h - 1, y + radius)
            for (x in 0 until w) {
                val x0 = maxOf(0, x - radius)
                val x1 = minOf(w - 1, x + radius)
                val count = (x1 - x0 + 1) * (y1 - y0 + 1)
                val sum = integral[(y1 + 1) * (w + 1) + x1 + 1] - integral[y0 * (w + 1) + x1 + 1] -
                    integral[(y1 + 1) * (w + 1) + x0] + integral[y0 * (w + 1) + x0]
                val black = gray[y * w + x].toLong() * count < sum.toLong() * factor
                pixels[y * w + x] = if (black) OPAQUE else 0xFFFFFFFF.toInt()
            }
        }
    }

    private const val BLOCK = 8

    /**
     * "Scan look" that keeps colour: estimates the paper's illumination (block maxima ignore ink, then a
     * wide blur), divides it out so shadows and uneven light vanish and paper becomes white, then
     * deepens the ink slightly with a gamma curve.
     */
    fun enhance(pixels: IntArray, w: Int, h: Int, gamma: Double = 1.35) {
        if (w < 2 || h < 2) return
        val bw = (w + BLOCK - 1) / BLOCK
        val bh = (h + BLOCK - 1) / BLOCK
        val blockMax = IntArray(bw * bh)
        for (y in 0 until h) for (x in 0 until w) {
            val l = luma(pixels[y * w + x])
            val bi = (y / BLOCK) * bw + (x / BLOCK)
            if (l > blockMax[bi]) blockMax[bi] = l
        }
        // Dilate by one block so ink wider than a block still can't darken the estimate, then smooth lightly.
        // (A wide blur would be pulled towards the interior at the borders and under-brighten the paper there.)
        val dilated = IntArray(bw * bh)
        for (y in 0 until bh) for (x in 0 until bw) {
            var m = 0
            for (dy in -1..1) for (dx in -1..1) {
                val nx = x + dx; val ny = y + dy
                if (nx in 0 until bw && ny in 0 until bh) m = maxOf(m, blockMax[ny * bw + nx])
            }
            dilated[y * bw + x] = m
        }
        val background = BoxBlur.apply(dilated, bw, bh, radius = 1, passes = 2)
        val lut = IntArray(256) { v -> (255.0 * Math.pow(v / 255.0, gamma)).toInt().coerceIn(0, 255) }
        for (y in 0 until h) {
            // Bilinear sample of the low-resolution illumination map.
            val gy = ((y + 0.5) / BLOCK - 0.5).coerceIn(0.0, (bh - 1).toDouble())
            val y0 = gy.toInt(); val y1 = minOf(y0 + 1, bh - 1); val fy = gy - y0
            for (x in 0 until w) {
                val gx = ((x + 0.5) / BLOCK - 0.5).coerceIn(0.0, (bw - 1).toDouble())
                val x0 = gx.toInt(); val x1 = minOf(x0 + 1, bw - 1); val fx = gx - x0
                val bg = (background[y0 * bw + x0] * (1 - fx) + background[y0 * bw + x1] * fx) * (1 - fy) +
                    (background[y1 * bw + x0] * (1 - fx) + background[y1 * bw + x1] * fx) * fy
                val gain = 255.0 / maxOf(bg, 40.0)  // don't amplify near-black regions into noise
                val p = pixels[y * w + x]
                val r = lut[(((p shr 16) and 0xFF) * gain).toInt().coerceIn(0, 255)]
                val g = lut[(((p shr 8) and 0xFF) * gain).toInt().coerceIn(0, 255)]
                val b = lut[((p and 0xFF) * gain).toInt().coerceIn(0, 255)]
                pixels[y * w + x] = OPAQUE or (r shl 16) or (g shl 8) or b
            }
        }
    }
}
