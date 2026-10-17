package com.saiteja.pdfscanner.imaging

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import com.saiteja.pdfscanner.data.FileStore
import com.saiteja.pdfscanner.domain.PageFilter
import com.saiteja.pdfscanner.domain.Quad
import com.saiteja.pdfscanner.domain.ScanPage
import java.io.File

/** Applies a page's non-destructive edits (crop + perspective, filter, rotation) to its source. */
class PageRenderer(private val files: FileStore) {

    fun sourceFile(page: ScanPage): File = files.pageFile(page.documentId, page.sourceFile)

    /** Decodes the unedited source, downsampled so its longest side is at least [maxSide]. */
    fun decodeSource(file: File, maxSide: Int): Bitmap? {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(file.path, bounds)
        if (bounds.outWidth <= 0) return null
        val opts = BitmapFactory.Options().apply {
            inSampleSize = ImageImporter.sampleSizeFor(bounds.outWidth, bounds.outHeight, maxSide)
            inPreferredConfig = Bitmap.Config.ARGB_8888
        }
        return BitmapFactory.decodeFile(file.path, opts)
    }

    /** Renders the page with its saved edits. Result's longest side is at most [maxSide]. */
    fun render(page: ScanPage, maxSide: Int): Bitmap = render(sourceFile(page), page.corners, page.rotation, page.filter, maxSide)

    fun render(
        file: File,
        corners: Quad,
        rotation: Int,
        filter: PageFilter,
        maxSide: Int,
    ): Bitmap {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(file.path, bounds)
        require(bounds.outWidth > 0) { "Unreadable page image" }

        // Decode only as much resolution as the cropped region needs to reach maxSide.
        val cropFraction = maxOf(
            maxOf(corners.tl.x, corners.tr.x, corners.br.x, corners.bl.x) - minOf(corners.tl.x, corners.tr.x, corners.br.x, corners.bl.x),
            maxOf(corners.tl.y, corners.tr.y, corners.br.y, corners.bl.y) - minOf(corners.tl.y, corners.tr.y, corners.br.y, corners.bl.y),
        ).coerceIn(0.05f, 1f)
        val target = (maxSide / cropFraction).toInt().coerceAtMost(ImageImporter.MAX_SOURCE_SIDE)
        val opts = BitmapFactory.Options().apply {
            inSampleSize = ImageImporter.sampleSizeFor(bounds.outWidth, bounds.outHeight, target)
            inPreferredConfig = Bitmap.Config.ARGB_8888
        }
        val src = BitmapFactory.decodeFile(file.path, opts) ?: error("Unreadable page image")

        val warped: Bitmap = try {
            if (corners.isFullFrame()) {
                scaleDown(src, maxSide)
            } else {
                val quadPx = corners.scaled(src.width.toFloat(), src.height.toFloat())
                val (outW, outH) = PerspectiveTransform.outputSize(quadPx, maxSide)
                val pixels = IntArray(src.width * src.height)
                src.getPixels(pixels, 0, src.width, 0, 0, src.width, src.height)
                val out = PerspectiveTransform.warp(pixels, src.width, src.height, quadPx, outW, outH)
                src.recycle()
                Bitmap.createBitmap(out, outW, outH, Bitmap.Config.ARGB_8888)
            }
        } catch (t: Throwable) {
            if (!src.isRecycled) src.recycle()
            throw t
        }

        val filtered = if (filter == PageFilter.ORIGINAL) warped else {
            val pixels = IntArray(warped.width * warped.height)
            warped.getPixels(pixels, 0, warped.width, 0, 0, warped.width, warped.height)
            ImageFilters.apply(pixels, warped.width, warped.height, filter)
            // Build a new bitmap rather than mutating: not every bitmap we are handed is mutable.
            Bitmap.createBitmap(pixels, warped.width, warped.height, Bitmap.Config.ARGB_8888).also { warped.recycle() }
        }
        return rotate(filtered, rotation)
    }

    private fun scaleDown(src: Bitmap, maxSide: Int): Bitmap {
        val longest = maxOf(src.width, src.height)
        if (longest <= maxSide) return src.copy(Bitmap.Config.ARGB_8888, true).also { src.recycle() }
        val s = maxSide.toFloat() / longest
        val scaled = Bitmap.createScaledBitmap(src, (src.width * s).toInt().coerceAtLeast(1), (src.height * s).toInt().coerceAtLeast(1), true)
        if (scaled !== src) src.recycle()
        return scaled
    }

    private fun rotate(bitmap: Bitmap, degrees: Int): Bitmap {
        if (degrees % 360 == 0) return bitmap
        val m = Matrix().apply { postRotate(degrees.toFloat()) }
        val rotated = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, m, true)
        if (rotated !== bitmap) bitmap.recycle()
        return rotated
    }
}
