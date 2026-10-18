package com.saiteja.pdfscanner.imaging

import android.content.ContentResolver
import android.graphics.Bitmap
import android.net.Uri
import com.saiteja.pdfscanner.domain.ImageFormat
import com.saiteja.pdfscanner.domain.ImageSizing
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.IOException
import java.io.OutputStream

/** Resizes and recompresses a single image. Standalone from documents; used by the Resize images tool. */
class ImageResizer(private val resolver: ContentResolver, private val importer: ImageImporter) {

    /** Writes the resized image to [out] and returns the encoded size in bytes. */
    suspend fun resize(uri: Uri, maxSide: Int?, format: ImageFormat, quality: Int, out: OutputStream): Long = withContext(Dispatchers.IO) {
        val decoded = try {
            importer.decodeUpright({ resolver.openInputStream(uri) }, maxSide ?: MAX_ORIGINAL_SIDE)
        } catch (e: OutOfMemoryError) {
            throw ImageImportException("Image is too large to process", e)
        }
        try {
            val (w, h) = ImageSizing.fitWithin(decoded.width, decoded.height, maxSide)
            val scaled = if (w == decoded.width && h == decoded.height) decoded else Bitmap.createScaledBitmap(decoded, w, h, true)
            try {
                val counting = CountingOutputStream(out)
                val ok = when (format) {
                    ImageFormat.JPEG -> scaled.compress(Bitmap.CompressFormat.JPEG, quality.coerceIn(1, 100), counting)
                    ImageFormat.PNG -> scaled.compress(Bitmap.CompressFormat.PNG, 100, counting)
                }
                if (!ok) throw IOException("Could not encode image")
                counting.flush()
                counting.count
            } finally {
                if (scaled !== decoded) scaled.recycle()
            }
        } finally {
            decoded.recycle()
        }
    }

    private class CountingOutputStream(private val inner: OutputStream) : OutputStream() {
        var count = 0L
            private set
        override fun write(b: Int) { inner.write(b); count++ }
        override fun write(b: ByteArray, off: Int, len: Int) { inner.write(b, off, len); count += len }
        override fun flush() = inner.flush()
    }

    private companion object {
        /** "Keep original size" still caps decoding so a 100-megapixel photo can't exhaust memory. */
        const val MAX_ORIGINAL_SIDE = 6000
    }
}
