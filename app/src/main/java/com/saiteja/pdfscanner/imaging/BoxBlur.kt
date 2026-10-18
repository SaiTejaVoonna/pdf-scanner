package com.saiteja.pdfscanner.imaging

/** Separable box blur on single-channel images; several passes approximate a Gaussian. */
internal object BoxBlur {
    fun apply(src: IntArray, w: Int, h: Int, radius: Int, passes: Int = 1): IntArray {
        var current = src
        repeat(passes) { current = once(current, w, h, radius) }
        return current
    }

    private fun once(src: IntArray, w: Int, h: Int, r: Int): IntArray {
        val tmp = IntArray(w * h)
        val out = IntArray(w * h)
        for (y in 0 until h) {
            var sum = 0
            var count = 0
            // Sliding window along the row.
            for (x in 0..minOf(r, w - 1)) { sum += src[y * w + x]; count++ }
            for (x in 0 until w) {
                tmp[y * w + x] = sum / count
                val add = x + r + 1
                val drop = x - r
                if (add < w) { sum += src[y * w + add]; count++ }
                if (drop >= 0) { sum -= src[y * w + drop]; count-- }
            }
        }
        for (x in 0 until w) {
            var sum = 0
            var count = 0
            for (y in 0..minOf(r, h - 1)) { sum += tmp[y * w + x]; count++ }
            for (y in 0 until h) {
                out[y * w + x] = sum / count
                val add = y + r + 1
                val drop = y - r
                if (add < h) { sum += tmp[add * w + x]; count++ }
                if (drop >= 0) { sum -= tmp[drop * w + x]; count-- }
            }
        }
        return out
    }
}
