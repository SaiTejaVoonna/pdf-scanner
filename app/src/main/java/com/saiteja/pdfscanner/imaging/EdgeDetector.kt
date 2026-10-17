package com.saiteja.pdfscanner.imaging

import com.saiteja.pdfscanner.domain.Pt
import com.saiteja.pdfscanner.domain.Quad

/**
 * Dependency-free document edge detection (no OpenCV, no Play services, fully offline).
 *
 * Approach: blur, Otsu-threshold into foreground/background (trying both "bright paper on dark
 * desk" and the reverse), take the large connected regions, fill their holes (printed text),
 * and read the four corner points from the x±y extremes. A region is accepted only if it is
 * nearly quadrilateral (high fill ratio), so cluttered scenes return null and the caller falls
 * back to the manual crop handles.
 */
object EdgeDetector {

    private const val MIN_REGION_FRACTION = 0.08f
    private const val MIN_FILL = 0.85f
    private const val MIN_QUAD_FRACTION = 0.12f
    private const val MAX_QUAD_FRACTION = 0.985f

    /** [gray] holds luma values 0..255, row-major, [w]*[h] entries. Returns normalized corners. */
    fun detect(gray: IntArray, w: Int, h: Int): Quad? {
        if (w < 16 || h < 16 || gray.size < w * h) return null
        val blurred = boxBlur(gray, w, h, 2)
        val threshold = otsu(blurred)
        var best: Quad? = null
        var bestScore = 0f
        for (bright in booleanArrayOf(true, false)) {
            val mask = BooleanArray(w * h) { if (bright) blurred[it] > threshold else blurred[it] <= threshold }
            for (candidate in candidates(mask, w, h)) {
                if (candidate.score > bestScore) {
                    bestScore = candidate.score
                    best = candidate.quad
                }
            }
        }
        return best
    }

    private class Candidate(val quad: Quad, val score: Float)

    private fun candidates(mask: BooleanArray, w: Int, h: Int): List<Candidate> {
        val total = w * h
        val visited = BooleanArray(total)
        val stack = IntArray(total)
        val result = ArrayList<Candidate>()
        val regions = ArrayList<Region>()

        for (start in 0 until total) {
            if (!mask[start] || visited[start]) continue
            val region = flood(start, mask, visited, stack, w, h)
            if (region.area >= total * MIN_REGION_FRACTION) regions += region
        }
        // Only the biggest few regions are worth the hole-filling pass.
        for (region in regions.sortedByDescending { it.area }.take(3)) {
            if (region.touchesAllBorders) continue // it's the background, not the document
            val filledArea = region.area + holeArea(region, mask, w, h)
            val quad = region.cornerQuad()
            val quadArea = pixelArea(quad)
            if (quadArea <= 0f) continue
            val fill = filledArea / quadArea
            val fraction = quadArea / total
            if (fill < MIN_FILL || fraction < MIN_QUAD_FRACTION || fraction > MAX_QUAD_FRACTION) continue
            val normalized = Quad(
                Pt(quad.tl.x / w, quad.tl.y / h), Pt(quad.tr.x / w, quad.tr.y / h),
                Pt(quad.br.x / w, quad.br.y / h), Pt(quad.bl.x / w, quad.bl.y / h),
            )
            if (!normalized.isConvex()) continue
            result += Candidate(normalized, quadArea * fill * fill)
        }
        return result
    }

    private class Region(val w: Int, val h: Int) {
        var area = 0
        var minSum = Int.MAX_VALUE; var minSumX = 0; var minSumY = 0
        var maxSum = Int.MIN_VALUE; var maxSumX = 0; var maxSumY = 0
        var minDiff = Int.MAX_VALUE; var minDiffX = 0; var minDiffY = 0
        var maxDiff = Int.MIN_VALUE; var maxDiffX = 0; var maxDiffY = 0
        var touchLeft = false; var touchRight = false; var touchTop = false; var touchBottom = false
        val touchesAllBorders get() = touchLeft && touchRight && touchTop && touchBottom
        val members = ArrayList<Int>()

        fun add(x: Int, y: Int) {
            area++
            val s = x + y
            val d = x - y
            if (s < minSum) { minSum = s; minSumX = x; minSumY = y }
            if (s > maxSum) { maxSum = s; maxSumX = x; maxSumY = y }
            if (d < minDiff) { minDiff = d; minDiffX = x; minDiffY = y }
            if (d > maxDiff) { maxDiff = d; maxDiffX = x; maxDiffY = y }
            if (x == 0) touchLeft = true
            if (x == w - 1) touchRight = true
            if (y == 0) touchTop = true
            if (y == h - 1) touchBottom = true
        }

        /** Corners in pixel units, expanded to pixel edges. */
        fun cornerQuad() = Quad(
            tl = Pt(minSumX.toFloat(), minSumY.toFloat()),
            tr = Pt(maxDiffX + 1f, maxDiffY.toFloat()),
            br = Pt(maxSumX + 1f, maxSumY + 1f),
            bl = Pt(minDiffX.toFloat(), minDiffY + 1f),
        )
    }

    private fun flood(start: Int, mask: BooleanArray, visited: BooleanArray, stack: IntArray, w: Int, h: Int): Region {
        val region = Region(w, h)
        var sp = 0
        stack[sp++] = start
        visited[start] = true
        while (sp > 0) {
            val i = stack[--sp]
            val x = i % w
            val y = i / w
            region.add(x, y)
            region.members.add(i)
            if (x > 0 && mask[i - 1] && !visited[i - 1]) { visited[i - 1] = true; stack[sp++] = i - 1 }
            if (x < w - 1 && mask[i + 1] && !visited[i + 1]) { visited[i + 1] = true; stack[sp++] = i + 1 }
            if (y > 0 && mask[i - w] && !visited[i - w]) { visited[i - w] = true; stack[sp++] = i - w }
            if (y < h - 1 && mask[i + w] && !visited[i + w]) { visited[i + w] = true; stack[sp++] = i + w }
        }
        return region
    }

    /** Number of pixels enclosed by the region (not in it, and not reachable from the image border). */
    private fun holeArea(region: Region, mask: BooleanArray, w: Int, h: Int): Int {
        val inRegion = BooleanArray(w * h)
        for (i in region.members) inRegion[i] = true
        val seen = BooleanArray(w * h)
        val stack = IntArray(w * h)
        var sp = 0
        var outside = 0
        fun push(i: Int) {
            if (!inRegion[i] && !seen[i]) { seen[i] = true; stack[sp++] = i }
        }
        for (x in 0 until w) { push(x); push((h - 1) * w + x) }
        for (y in 0 until h) { push(y * w); push(y * w + w - 1) }
        while (sp > 0) {
            val i = stack[--sp]
            outside++
            val x = i % w
            val y = i / w
            if (x > 0) push(i - 1)
            if (x < w - 1) push(i + 1)
            if (y > 0) push(i - w)
            if (y < h - 1) push(i + w)
        }
        return w * h - region.area - outside
    }

    private fun pixelArea(q: Quad) = q.area()

    private fun boxBlur(src: IntArray, w: Int, h: Int, r: Int): IntArray {
        val tmp = IntArray(w * h)
        val out = IntArray(w * h)
        for (y in 0 until h) {
            for (x in 0 until w) {
                var sum = 0
                var n = 0
                for (k in -r..r) {
                    val xx = x + k
                    if (xx in 0 until w) { sum += src[y * w + xx]; n++ }
                }
                tmp[y * w + x] = sum / n
            }
        }
        for (y in 0 until h) {
            for (x in 0 until w) {
                var sum = 0
                var n = 0
                for (k in -r..r) {
                    val yy = y + k
                    if (yy in 0 until h) { sum += tmp[yy * w + x]; n++ }
                }
                out[y * w + x] = sum / n
            }
        }
        return out
    }

    private fun otsu(gray: IntArray): Int {
        val hist = IntArray(256)
        for (v in gray) hist[v.coerceIn(0, 255)]++
        val total = gray.size.toDouble()
        var sumAll = 0.0
        for (i in 0..255) sumAll += i * hist[i].toDouble()
        var sumB = 0.0
        var wB = 0.0
        var best = 0.0
        var threshold = 127
        for (t in 0..255) {
            wB += hist[t]
            if (wB == 0.0) continue
            val wF = total - wB
            if (wF == 0.0) break
            sumB += t * hist[t].toDouble()
            val mB = sumB / wB
            val mF = (sumAll - sumB) / wF
            val between = wB * wF * (mB - mF) * (mB - mF)
            if (between > best) { best = between; threshold = t }
        }
        return threshold
    }
}
