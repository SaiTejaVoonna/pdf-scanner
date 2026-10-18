package com.saiteja.pdfscanner.imaging

import android.content.ContentResolver
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import kotlin.coroutines.coroutineContext

class PdfImportException(message: String, val passwordProtected: Boolean = false, cause: Throwable? = null) : IOException(message, cause)

/**
 * Turns the pages of an existing PDF into images using Android's built-in [PdfRenderer] (offline, no
 * extra libraries). Pages become ordinary editable pages, which is how PDFs are combined, split and
 * reordered. Note the result is raster: text in the imported PDF is no longer selectable.
 */
class PdfPageImporter(private val resolver: ContentResolver) {

    /**
     * Renders each page to a JPEG produced by [newFile] and reports it through [onPage] as soon as it
     * exists, so memory stays bounded however long the PDF is. Returns the number of pages rendered.
     */
    suspend fun import(uri: Uri, newFile: () -> File, onPage: suspend (File) -> Unit): Int = withContext(Dispatchers.IO) {
        val descriptor = try {
            resolver.openFileDescriptor(uri, "r") ?: throw PdfImportException("Cannot open the PDF")
        } catch (e: java.io.FileNotFoundException) {
            throw PdfImportException("Cannot open the PDF", cause = e)
        }
        descriptor.use { pfd ->
            val renderer = try {
                PdfRenderer(pfd)
            } catch (e: SecurityException) {
                throw PdfImportException("The PDF is password protected", passwordProtected = true, cause = e)
            } catch (e: IOException) {
                throw PdfImportException("Not a readable PDF", cause = e)
            } catch (e: IllegalArgumentException) {
                throw PdfImportException("Not a readable PDF", cause = e)
            }
            renderer.use { r ->
                if (r.pageCount == 0) throw PdfImportException("The PDF has no pages")
                var done = 0
                for (index in 0 until r.pageCount) {
                    coroutineContext.ensureActive()
                    val file = newFile()
                    try {
                        renderPage(r, index, file)
                        onPage(file)
                        done++
                    } catch (e: Exception) {
                        file.delete()
                        if (e is kotlinx.coroutines.CancellationException) throw e
                        throw PdfImportException("Could not render page ${index + 1}", cause = e)
                    }
                }
                done
            }
        }
    }

    private fun renderPage(renderer: PdfRenderer, index: Int, file: File) {
        renderer.openPage(index).use { page ->
            val (w, h) = targetSize(page.width, page.height)
            val bitmap = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
            try {
                bitmap.eraseColor(Color.WHITE) // PdfRenderer draws onto transparent pixels
                page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                FileOutputStream(file).use { bitmap.compress(Bitmap.CompressFormat.JPEG, 90, it) }
            } finally {
                bitmap.recycle()
            }
        }
    }

    companion object {
        private const val RENDER_DPI = 200f
        private const val MAX_SIDE = 2400

        /** Pixel size for a page of [widthPt]x[heightPt] points at about 200 dpi, capped to [MAX_SIDE]. */
        fun targetSize(widthPt: Int, heightPt: Int): Pair<Int, Int> {
            val scale = minOf(RENDER_DPI / 72f, MAX_SIDE / maxOf(widthPt, heightPt, 1).toFloat())
            return Pair((widthPt * scale).toInt().coerceAtLeast(1), (heightPt * scale).toInt().coerceAtLeast(1))
        }
    }
}
