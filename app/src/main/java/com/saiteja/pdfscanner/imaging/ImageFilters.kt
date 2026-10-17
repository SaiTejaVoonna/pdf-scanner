package com.saiteja.pdfscanner.imaging

import com.saiteja.pdfscanner.domain.PageFilter

/** Pixel filters over ARGB arrays. All functions return a new array or modify in place as noted. */
object ImageFilters {

    private const val OPAQUE = 0xFF shl 24

    fun apply(pixels: IntArray, w: Int, h: Int, filter: PageFilter) {
        when (filter) {
            PageFilter.ORIGINAL -> Unit
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
}
