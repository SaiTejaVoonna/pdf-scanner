package com.saiteja.pdfscanner.imaging

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.net.Uri
import androidx.exifinterface.media.ExifInterface
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.io.InputStream

class ImageImportException(message: String, cause: Throwable? = null) : IOException(message, cause)

/**
 * Normalises camera shots and picked photos into upright, size-capped JPEG source files so that
 * every later stage (detection, cropping, rendering) can ignore EXIF orientation and avoid
 * decoding multi-ten-megapixel images.
 */
class ImageImporter(context: Context) {
    private val resolver = context.applicationContext.contentResolver

    suspend fun import(uri: Uri, destination: File): Unit = withContext(Dispatchers.IO) {
        try {
            importStreams({ resolver.openInputStream(uri) }, destination)
        } catch (e: OutOfMemoryError) {
            destination.delete()
            throw ImageImportException("Image is too large to process", e)
        }
    }

    suspend fun import(file: File, destination: File): Unit = withContext(Dispatchers.IO) {
        try {
            importStreams({ file.inputStream() }, destination)
        } catch (e: OutOfMemoryError) {
            destination.delete()
            throw ImageImportException("Image is too large to process", e)
        }
    }

    private fun importStreams(open: () -> InputStream?, destination: File) {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        (open() ?: throw ImageImportException("Cannot open image")).use { BitmapFactory.decodeStream(it, null, bounds) }
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) throw ImageImportException("Not a supported image")

        val orientation = (open() ?: throw ImageImportException("Cannot open image")).use {
            runCatching {
                ExifInterface(it).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)
            }.getOrDefault(ExifInterface.ORIENTATION_NORMAL)
        }

        val options = BitmapFactory.Options().apply {
            inSampleSize = sampleSizeFor(bounds.outWidth, bounds.outHeight, MAX_SOURCE_SIDE)
            inPreferredConfig = Bitmap.Config.ARGB_8888
        }
        val decoded = (open() ?: throw ImageImportException("Cannot open image")).use {
            BitmapFactory.decodeStream(it, null, options)
        } ?: throw ImageImportException("Not a supported image")

        var upright = applyOrientation(decoded, orientation)
        val longest = maxOf(upright.width, upright.height)
        if (longest > MAX_SOURCE_SIDE) {
            val s = MAX_SOURCE_SIDE.toFloat() / longest
            val scaled = Bitmap.createScaledBitmap(upright, (upright.width * s).toInt().coerceAtLeast(1), (upright.height * s).toInt().coerceAtLeast(1), true)
            if (scaled !== upright) upright.recycle()
            upright = scaled
        }
        try {
            FileOutputStream(destination).use { upright.compress(Bitmap.CompressFormat.JPEG, SOURCE_QUALITY, it) }
        } catch (e: IOException) {
            destination.delete()
            throw ImageImportException("Could not save image", e)
        } finally {
            upright.recycle()
        }
    }

    private fun applyOrientation(bitmap: Bitmap, orientation: Int): Bitmap {
        val m = Matrix()
        when (orientation) {
            ExifInterface.ORIENTATION_ROTATE_90 -> m.postRotate(90f)
            ExifInterface.ORIENTATION_ROTATE_180 -> m.postRotate(180f)
            ExifInterface.ORIENTATION_ROTATE_270 -> m.postRotate(270f)
            ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> m.postScale(-1f, 1f)
            ExifInterface.ORIENTATION_FLIP_VERTICAL -> m.postScale(1f, -1f)
            ExifInterface.ORIENTATION_TRANSPOSE -> { m.postRotate(90f); m.postScale(-1f, 1f) }
            ExifInterface.ORIENTATION_TRANSVERSE -> { m.postRotate(270f); m.postScale(-1f, 1f) }
            else -> return bitmap
        }
        val rotated = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, m, true)
        if (rotated !== bitmap) bitmap.recycle()
        return rotated
    }

    companion object {
        const val MAX_SOURCE_SIDE = 3000
        private const val SOURCE_QUALITY = 92

        /** Largest power-of-two sample size that keeps the longest side at or above [target]. */
        fun sampleSizeFor(width: Int, height: Int, target: Int): Int {
            var sample = 1
            val longest = maxOf(width, height)
            while (longest / (sample * 2) >= target) sample *= 2
            return sample
        }
    }
}
