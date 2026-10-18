package com.saiteja.pdfscanner.imaging

import com.saiteja.pdfscanner.domain.Pt
import com.saiteja.pdfscanner.domain.Quad
import kotlin.math.abs
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt

/**
 * Offline page-corner detection with no native libraries and no Google services.
 *
 * 1. Canny edges (colour-aware) and a Hough transform find the dominant straight lines.
 * 2. Every plausible quadrilateral made from those lines (plus the image frame, for pages cut off by
 *    the frame) is scored by how much of its outline lies on real image edges, how much of the
 *    picture it covers, and how rectangular it looks after perspective.
 * 3. A second, brightness-based segmentation proposes extra candidates for smooth backgrounds; they are
 *    scored by the same rule so the better evidence wins.
 *
 * Returns null when nothing convincing is found, so the caller keeps the full image and the user adjusts
 * the corners by hand. Never guesses.
 */
object EdgeDetector {

    private const val MIN_AREA_FRACTION = 0.12f
    private const val MAX_AREA_FRACTION = 0.985f
    private const val MIN_MEAN_SUPPORT = 0.55f
    private const val MIN_SIDE_SUPPORT = 0.35f
    private const val BORDER_SUPPORT_WEIGHT = 0.5f
    private const val MIN_SIDE_CONTRAST = 8.0       // luma/colour levels between inside and outside of a side
    private const val FULL_CONTRAST = 25.0
    private val CONTRAST_OFFSETS_PX = intArrayOf(4, 7, 10, 13, 16)
    private const val MAX_NEAR_DENSITY = 0.65       // beyond this the "edges" are just texture or noise
    private const val BORDER_PENALTY = 0.9

    /** [gray] holds luma 0..255, row-major, [w]*[h] entries. Returns normalized corners. */
    fun detect(gray: IntArray, w: Int, h: Int): Quad? = detectChannels(listOf(gray), w, h)

    /** Same as [detect] for ARGB pixels; also notices pages that differ from the background only in colour. */
    fun detectArgb(argb: IntArray, w: Int, h: Int): Quad? {
        if (argb.size < w * h) return null
        val r = IntArray(w * h) { (argb[it] shr 16) and 0xFF }
        val g = IntArray(w * h) { (argb[it] shr 8) and 0xFF }
        val b = IntArray(w * h) { argb[it] and 0xFF }
        return detectChannels(listOf(r, g, b), w, h)
    }

    private fun detectChannels(channels: List<IntArray>, w: Int, h: Int): Quad? {
        if (w < 32 || h < 32 || channels.any { it.size < w * h }) return null
        val edges = CannyEdges.detect(channels, w, h)
        val near = dilate(edges, w, h, radius = 2)
        if (near.count { it } > MAX_NEAR_DENSITY * w * h) return null
        val smooth = channels.map { BoxBlur.apply(it, w, h, 2) }
        val scorer = Scorer(near, smooth, w, h)

        var best: Scored? = null
        fun consider(q: PixelQuad?) {
            val s = q?.let { scorer.score(it) } ?: return
            if (best == null || s.score > best!!.score) best = s
        }

        // Candidates from straight lines.
        val minVotes = (0.25f * min(w, h)).toInt().coerceAtLeast(12)
        val lines = HoughLines.find(edges, w, h, minVotes, maxLines = 28) + HoughLines.borderLines(w, h)
        forEachQuad(lines) { consider(it) }

        // Candidates from brightness segmentation.
        val luma = if (channels.size == 3) IntArray(w * h) { (channels[0][it] * 299 + channels[1][it] * 587 + channels[2][it] * 114) / 1000 } else channels[0]
        for (q in RegionCandidates.find(luma, w, h)) {
            consider(PixelQuad(q.tl.x * w, q.tl.y * h, q.tr.x * w, q.tr.y * h, q.br.x * w, q.br.y * h, q.bl.x * w, q.bl.y * h, borderSides = BooleanArray(4)))
        }

        val result = best ?: return null
        return result.quad.takeIf { it.isValidCrop() }
    }

    // ---------------------------------------------------------------------------------------------

    private class PixelQuad(
        val x0: Double, val y0: Double, val x1: Double, val y1: Double,
        val x2: Double, val y2: Double, val x3: Double, val y3: Double,
        val borderSides: BooleanArray,
    ) {
        constructor(x0: Float, y0: Float, x1: Float, y1: Float, x2: Float, y2: Float, x3: Float, y3: Float, borderSides: BooleanArray) :
            this(x0.toDouble(), y0.toDouble(), x1.toDouble(), y1.toDouble(), x2.toDouble(), y2.toDouble(), x3.toDouble(), y3.toDouble(), borderSides)

        fun xs() = doubleArrayOf(x0, x1, x2, x3)
        fun ys() = doubleArrayOf(y0, y1, y2, y3)
    }

    private class Scored(val quad: Quad, val score: Double)

    private class Scorer(val near: BooleanArray, val smooth: List<IntArray>, val w: Int, val h: Int) {
        fun score(q: PixelQuad): Scored? {
            val xs = q.xs()
            val ys = q.ys()
            // Clamp slightly-outside corners (page cut by frame) to the frame.
            val cx = DoubleArray(4) { xs[it].coerceIn(0.0, w.toDouble()) }
            val cy = DoubleArray(4) { ys[it].coerceIn(0.0, h.toDouble()) }
            val quad = Quad(
                Pt((cx[0] / w).toFloat(), (cy[0] / h).toFloat()), Pt((cx[1] / w).toFloat(), (cy[1] / h).toFloat()),
                Pt((cx[2] / w).toFloat(), (cy[2] / h).toFloat()), Pt((cx[3] / w).toFloat(), (cy[3] / h).toFloat()),
            )
            if (!quad.isValidCrop()) return null
            val area = quad.area()
            if (area < MIN_AREA_FRACTION || area > MAX_AREA_FRACTION) return null
            if (!anglesPlausible(cx, cy)) return null

            var sum = 0.0
            var weakest = 1.0
            var genuineSides = 0
            var borderSides = 0
            var contrastSum = 0.0
            val centreX = cx.average()
            val centreY = cy.average()
            for (i in 0 until 4) {
                val j = (i + 1) % 4
                val (support, onBorder) = sideSupport(cx[i], cy[i], cx[j], cy[j])
                if (onBorder) borderSides++ else {
                    genuineSides++
                    weakest = min(weakest, support)
                    // A real page edge has paper on one side and desk on the other; a printed line has paper on both.
                    val contrast = sideContrast(cx[i], cy[i], cx[j], cy[j], centreX, centreY)
                    if (contrast < MIN_SIDE_CONTRAST) return null
                    contrastSum += contrast
                }
                sum += support
            }
            val mean = sum / 4
            if (genuineSides < 2 || borderSides > 2) return null
            if (mean < MIN_MEAN_SUPPORT || weakest < MIN_SIDE_SUPPORT) return null
            if (borderSides == 4) return null
            val contrastFactor = sqrt(min(1.0, contrastSum / genuineSides / FULL_CONTRAST))
            val borderFactor = Math.pow(BORDER_PENALTY, borderSides.toDouble())
            return Scored(quad, Math.pow(area.toDouble(), 0.7) * mean * mean * (0.5 + 0.5 * weakest) * contrastFactor * borderFactor)
        }

        /**
         * Step in the *brightest* level of each colour channel across the side, comparing bands either side
         * ([CONTRAST_OFFSETS_PX]). Using the band maximum (the paper level) rather than the mean means the edge
         * of a block of printed text, which has white paper on both sides, shows no step, while a page-to-desk
         * boundary still does.
         */
        private fun sideContrast(ax: Double, ay: Double, bx: Double, by: Double, centreX: Double, centreY: Double): Double {
            val length = hypot(bx - ax, by - ay)
            var nx = -(by - ay) / length
            var ny = (bx - ax) / length
            val mx = (ax + bx) / 2
            val my = (ay + by) / 2
            if ((mx - centreX) * nx + (my - centreY) * ny < 0) { nx = -nx; ny = -ny }  // point away from the centre
            var total = 0.0
            var count = 0
            val steps = max(8, (length / 2).toInt())
            val inside = DoubleArray(smooth.size)
            val outside = DoubleArray(smooth.size)
            for (s in 1 until steps) {
                val t = s.toDouble() / steps
                val x = ax + (bx - ax) * t
                val y = ay + (by - ay) * t
                inside.fill(0.0); outside.fill(0.0)
                var used = 0
                for (d in CONTRAST_OFFSETS_PX) {
                    val ox = (x + nx * d).toInt(); val oy = (y + ny * d).toInt()
                    val ix = (x - nx * d).toInt(); val iy = (y - ny * d).toInt()
                    if (ox !in 0 until w || oy !in 0 until h || ix !in 0 until w || iy !in 0 until h) continue
                    for (c in smooth.indices) {
                        outside[c] = max(outside[c], smooth[c][oy * w + ox].toDouble())
                        inside[c] = max(inside[c], smooth[c][iy * w + ix].toDouble())
                    }
                    used++
                }
                if (used < 3) continue
                var diff = 0.0
                for (c in smooth.indices) diff = max(diff, abs(outside[c] - inside[c]))
                total += diff
                count++
            }
            return if (count == 0) 0.0 else total / count
        }

        /** Fraction of the side's length lying on image edges; samples on the frame count half. */
        private fun sideSupport(ax: Double, ay: Double, bx: Double, by: Double): Pair<Double, Boolean> {
            val length = hypot(bx - ax, by - ay)
            val steps = max(8, length.toInt())
            var total = 0.0
            var onBorderCount = 0
            for (s in 0..steps) {
                val t = s.toDouble() / steps
                val x = ax + (bx - ax) * t
                val y = ay + (by - ay) * t
                val ix = x.toInt().coerceIn(0, w - 1)
                val iy = y.toInt().coerceIn(0, h - 1)
                val onFrame = x <= 2.0 || y <= 2.0 || x >= w - 2.0 || y >= h - 2.0
                if (onFrame) { onBorderCount++; total += BORDER_SUPPORT_WEIGHT }
                else if (near[iy * w + ix]) total += 1.0
            }
            val samples = steps + 1
            return (total / samples) to (onBorderCount > samples * 0.8)
        }

        /** Interior angles must stay near a rectangle's, allowing for perspective. */
        private fun anglesPlausible(xs: DoubleArray, ys: DoubleArray): Boolean {
            for (i in 0 until 4) {
                val p = (i + 3) % 4
                val n = (i + 1) % 4
                val ux = xs[p] - xs[i]; val uy = ys[p] - ys[i]
                val vx = xs[n] - xs[i]; val vy = ys[n] - ys[i]
                val lu = hypot(ux, uy); val lv = hypot(vx, vy)
                if (lu < 4 || lv < 4) return false
                val cos = (ux * vx + uy * vy) / (lu * lv)
                val deg = Math.toDegrees(Math.acos(cos.coerceIn(-1.0, 1.0)))
                if (deg < 50.0 || deg > 130.0) return false
            }
            val top = hypot(xs[1] - xs[0], ys[1] - ys[0]); val bottom = hypot(xs[2] - xs[3], ys[2] - ys[3])
            val left = hypot(xs[3] - xs[0], ys[3] - ys[0]); val right = hypot(xs[2] - xs[1], ys[2] - ys[1])
            val wAvg = (top + bottom) / 2; val hAvg = (left + right) / 2
            val ratio = max(wAvg, hAvg) / max(1.0, min(wAvg, hAvg))
            return ratio <= 4.5 && min(top, bottom) / max(top, bottom) > 0.35 && min(left, right) / max(left, right) > 0.35
        }
    }

    /** Enumerates quadrilaterals formed by two near-parallel line pairs that cross each other. */
    private fun forEachQuad(lines: List<Line>, emit: (PixelQuad?) -> Unit) {
        val n = lines.size
        for (a in 0 until n) for (b in a + 1 until n) for (c in b + 1 until n) for (d in c + 1 until n) {
            val set = intArrayOf(a, b, c, d)
            // Three ways to split four lines into two pairs; accept the split where each pair is roughly parallel.
            val splits = arrayOf(intArrayOf(0, 1, 2, 3), intArrayOf(0, 2, 1, 3), intArrayOf(0, 3, 1, 2))
            for (sp in splits) {
                val p1 = lines[set[sp[0]]]; val p2 = lines[set[sp[1]]]
                val q1 = lines[set[sp[2]]]; val q2 = lines[set[sp[3]]]
                if (p1.isBorder && p2.isBorder && q1.isBorder && q2.isBorder) continue
                if (angleDiff(p1, p2) > 35.0 || angleDiff(q1, q2) > 35.0) continue
                if (angleDiff(p1, q1) < 40.0 || angleDiff(p1, q2) < 40.0 || angleDiff(p2, q1) < 40.0 || angleDiff(p2, q2) < 40.0) continue
                val i1 = p1.intersect(q1) ?: continue
                val i2 = p1.intersect(q2) ?: continue
                val i3 = p2.intersect(q2) ?: continue
                val i4 = p2.intersect(q1) ?: continue
                val pts = listOf(i1, i2, i3, i4)
                val ordered = Quad.ordered(pts.map { Pt(it.first.toFloat(), it.second.toFloat()) })
                val borderSides = BooleanArray(4)
                emit(
                    PixelQuad(
                        ordered.tl.x.toDouble(), ordered.tl.y.toDouble(), ordered.tr.x.toDouble(), ordered.tr.y.toDouble(),
                        ordered.br.x.toDouble(), ordered.br.y.toDouble(), ordered.bl.x.toDouble(), ordered.bl.y.toDouble(), borderSides,
                    ),
                )
            }
        }
    }

    private fun angleDiff(a: Line, b: Line): Double {
        val d = abs(a.directionDeg - b.directionDeg)
        return min(d, 180.0 - d)
    }

    private fun dilate(src: BooleanArray, w: Int, h: Int, radius: Int): BooleanArray {
        val out = BooleanArray(w * h)
        for (y in 0 until h) for (x in 0 until w) {
            if (!src[y * w + x]) continue
            for (dy in -radius..radius) for (dx in -radius..radius) {
                val nx = x + dx; val ny = y + dy
                if (nx in 0 until w && ny in 0 until h) out[ny * w + nx] = true
            }
        }
        return out
    }

}
