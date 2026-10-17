package com.saiteja.pdfscanner.domain

import kotlin.math.abs
import kotlin.math.hypot

/** A point; coordinates are normalized to 0..1 of the image unless stated otherwise. */
data class Pt(val x: Float, val y: Float)

/** Four corners of a document, in clockwise order starting at the top-left. */
data class Quad(val tl: Pt, val tr: Pt, val br: Pt, val bl: Pt) {

    val points: List<Pt> get() = listOf(tl, tr, br, bl)

    fun withPoint(index: Int, p: Pt): Quad = when (index) {
        0 -> copy(tl = p)
        1 -> copy(tr = p)
        2 -> copy(br = p)
        else -> copy(bl = p)
    }

    fun scaled(sx: Float, sy: Float): Quad =
        Quad(tl.scaled(sx, sy), tr.scaled(sx, sy), br.scaled(sx, sy), bl.scaled(sx, sy))

    fun coerceIn01(): Quad {
        fun Pt.c() = Pt(x.coerceIn(0f, 1f), y.coerceIn(0f, 1f))
        return Quad(tl.c(), tr.c(), br.c(), bl.c())
    }

    /** Shoelace area, positive when TL→TR→BR→BL runs clockwise on screen (y grows downward). */
    fun signedArea(): Float {
        val p = points
        var sum = 0f
        for (i in p.indices) {
            val a = p[i]
            val b = p[(i + 1) % 4]
            sum += a.x * b.y - b.x * a.y
        }
        return sum / 2f
    }

    fun area(): Float = abs(signedArea())

    /** True when the polygon is convex and non-degenerate (no crossed edges, no collapsed corner). */
    fun isConvex(): Boolean {
        val p = points
        var sign = 0
        for (i in p.indices) {
            val a = p[i]
            val b = p[(i + 1) % 4]
            val c = p[(i + 2) % 4]
            val cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)
            if (abs(cross) < 1e-7f) return false
            val s = if (cross > 0) 1 else -1
            if (sign == 0) sign = s else if (s != sign) return false
        }
        return true
    }

    /**
     * A crop is usable when it is convex, wound clockwise (the opposite winding would mirror or
     * flip the page) and covers a meaningful part of the image.
     */
    fun isValidCrop(minArea: Float = 0.02f): Boolean = isConvex() && signedArea() > 0f && area() >= minArea

    fun isFullFrame(eps: Float = 0.002f): Boolean =
        abs(tl.x) < eps && abs(tl.y) < eps && abs(tr.x - 1f) < eps && abs(tr.y) < eps &&
            abs(br.x - 1f) < eps && abs(br.y - 1f) < eps && abs(bl.x) < eps && abs(bl.y - 1f) < eps

    fun toStorage(): String = points.joinToString(",") { "${it.x},${it.y}" }

    companion object {
        val FULL = Quad(Pt(0f, 0f), Pt(1f, 0f), Pt(1f, 1f), Pt(0f, 1f))

        fun fromStorage(text: String): Quad? {
            val v = text.split(",").mapNotNull { it.trim().toFloatOrNull() }
            if (v.size != 8) return null
            return Quad(Pt(v[0], v[1]), Pt(v[2], v[3]), Pt(v[4], v[5]), Pt(v[6], v[7]))
        }

        fun fromFloats(v: FloatArray): Quad? =
            if (v.size != 8) null else Quad(Pt(v[0], v[1]), Pt(v[2], v[3]), Pt(v[4], v[5]), Pt(v[6], v[7]))

        /** Orders four arbitrary points as TL, TR, BR, BL. */
        fun ordered(pts: List<Pt>): Quad {
            require(pts.size == 4)
            val tl = pts.minBy { it.x + it.y }
            val br = pts.maxBy { it.x + it.y }
            val tr = pts.maxBy { it.x - it.y }
            val bl = pts.minBy { it.x - it.y }
            return Quad(tl, tr, br, bl)
        }
    }
}

fun Quad.toFloats(): FloatArray = floatArrayOf(tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y)

private fun Pt.scaled(sx: Float, sy: Float) = Pt(x * sx, y * sy)

fun distance(a: Pt, b: Pt): Float = hypot(a.x - b.x, a.y - b.y)
