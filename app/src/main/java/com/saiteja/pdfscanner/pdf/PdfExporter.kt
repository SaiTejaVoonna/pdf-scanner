package com.saiteja.pdfscanner.pdf

import android.graphics.Bitmap
import com.saiteja.pdfscanner.data.DocumentRepository
import com.saiteja.pdfscanner.data.FileStore
import com.saiteja.pdfscanner.domain.FileNames
import com.saiteja.pdfscanner.domain.PdfPageSize
import com.saiteja.pdfscanner.imaging.PageRenderer
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.OutputStream

class ExportException(message: String, cause: Throwable? = null) : Exception(message, cause)

/** Renders every page of a document and streams it into a multipage PDF. */
class PdfExporter(
    private val repository: DocumentRepository,
    private val renderer: PageRenderer,
    private val files: FileStore,
) {
    /** Writes the PDF for [documentId] to [out]. Runs off the main thread and honours cancellation. */
    suspend fun export(
        documentId: String,
        pageSize: PdfPageSize,
        title: String,
        out: OutputStream,
        onProgress: (done: Int, total: Int) -> Unit = { _, _ -> },
    ) = withContext(Dispatchers.Default) {
        val pages = repository.getPages(documentId)
        if (pages.isEmpty()) throw ExportException("This document has no pages")
        val job = currentCoroutineContext()
        try {
            PdfWriter.write(out, pages.size, pageSize, title, onProgress = onProgress) { index ->
                job.ensureActive()
                val bitmap = renderer.render(pages[index], EXPORT_MAX_SIDE)
                try {
                    val bytes = ByteArrayOutputStream(bitmap.byteCount / 8)
                    bitmap.compress(Bitmap.CompressFormat.JPEG, JPEG_QUALITY, bytes)
                    PdfImage(bytes.toByteArray(), bitmap.width, bitmap.height)
                } finally {
                    bitmap.recycle()
                }
            }
        } catch (e: CancellationException) {
            throw e
        } catch (e: OutOfMemoryError) {
            throw ExportException("Not enough memory to export. Try fewer pages.", e)
        } catch (e: Exception) {
            throw ExportException(e.message ?: "Export failed", e)
        }
    }

    /** Exports into the cache directory for sharing and returns the file. */
    suspend fun exportToCache(documentId: String, pageSize: PdfPageSize, fileName: String, onProgress: (Int, Int) -> Unit = { _, _ -> }): File {
        val dir = files.exportDir
        dir.listFiles()?.forEach { it.delete() }
        val target = File(dir, FileNames.pdfFileName(fileName))
        try {
            withContext(Dispatchers.IO) {
                target.outputStream().buffered().use { export(documentId, pageSize, fileName, it, onProgress) }
            }
        } catch (t: Throwable) {
            target.delete()
            throw t
        }
        return target
    }

    companion object {
        /** About 300 dpi on A4. */
        const val EXPORT_MAX_SIDE = 2480
        const val JPEG_QUALITY = 85
    }
}
