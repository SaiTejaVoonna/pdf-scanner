package com.saiteja.pdfscanner.imaging

import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.roundToInt
import kotlin.math.sin

/** A line x·cosθ + y·sinθ = ρ in pixel coordinates. [isBorder] marks the image frame itself. */
internal class Line(val theta: Double, val rho: Double, val votes: Int, val isBorder: Boolean = false) {
    /** Direction angle of the line itself, folded into [0°, 180°). */
    val directionDeg: Double get() = ((Math.toDegrees(theta) + 90.0) % 180.0 + 180.0) % 180.0

    fun intersect(o: Line): Pair<Double, Double>? {
        val det = cos(theta) * sin(o.theta) - sin(theta) * cos(o.theta)
        if (abs(det) < 1e-6) return null
        val x = (rho * sin(o.theta) - o.rho * sin(theta)) / det
        val y = (o.rho * cos(theta) - rho * cos(o.theta)) / det
        return x to y
    }

    /** True when both lines are almost the same line (angle and offset), allowing for θ wrap-around. */
    fun nearlySameAs(o: Line, angleTolDeg: Double, rhoTol: Double): Boolean {
        var dTheta = abs(Math.toDegrees(theta) - Math.toDegrees(o.theta))
        var otherRho = o.rho
        if (dTheta > 90.0) { dTheta = 180.0 - dTheta; otherRho = -o.rho }
        return dTheta <= angleTolDeg && abs(rho - otherRho) <= rhoTol
    }
}

internal object HoughLines {
    private const val ANGLE_BINS = 180

    /** Strongest straight lines through the edge map, with near-duplicates suppressed. */
    fun find(edges: BooleanArray, w: Int, h: Int, minVotes: Int, maxLines: Int): List<Line> {
        val diag = hypot(w.toDouble(), h.toDouble()).toInt() + 2
        val rhoBins = 2 * diag + 1
        val acc = IntArray(ANGLE_BINS * rhoBins)
        val cosT = DoubleArray(ANGLE_BINS) { cos(Math.toRadians(it.toDouble())) }
        val sinT = DoubleArray(ANGLE_BINS) { sin(Math.toRadians(it.toDouble())) }
        for (y in 0 until h) for (x in 0 until w) {
            if (!edges[y * w + x]) continue
            val px = x + 0.5
            val py = y + 0.5
            for (t in 0 until ANGLE_BINS) {
                val rho = (px * cosT[t] + py * sinT[t]).roundToInt() + diag
                acc[t * rhoBins + rho]++
            }
        }
        // Smooth across neighbouring rho bins so slightly bowed edges still form one peak.
        class Peak(val t: Int, val r: Int, val votes: Int)
        val peaks = ArrayList<Peak>()
        for (t in 0 until ANGLE_BINS) for (r in 1 until rhoBins - 1) {
            val v = acc[t * rhoBins + r - 1] + acc[t * rhoBins + r] + acc[t * rhoBins + r + 1]
            if (v >= minVotes && acc[t * rhoBins + r] >= acc[t * rhoBins + r - 1] && acc[t * rhoBins + r] >= acc[t * rhoBins + r + 1]) {
                peaks += Peak(t, r, v)
            }
        }
        peaks.sortByDescending { it.votes }
        val lines = ArrayList<Line>()
        for (p in peaks) {
            val candidate = Line(Math.toRadians(p.t.toDouble()), (p.r - diag).toDouble(), p.votes)
            if (lines.none { it.nearlySameAs(candidate, angleTolDeg = 6.0, rhoTol = 10.0) }) {
                lines += candidate
                if (lines.size >= maxLines) break
            }
        }
        return lines
    }

    /** The four sides of the image frame, usable as page sides when a page is cut off by the frame. */
    fun borderLines(w: Int, h: Int): List<Line> = listOf(
        Line(Math.toRadians(90.0), 0.0, 0, isBorder = true),            // top    y = 0
        Line(Math.toRadians(0.0), w.toDouble(), 0, isBorder = true),    // right  x = w
        Line(Math.toRadians(90.0), h.toDouble(), 0, isBorder = true),   // bottom y = h
        Line(Math.toRadians(0.0), 0.0, 0, isBorder = true),             // left   x = 0
    )
}
