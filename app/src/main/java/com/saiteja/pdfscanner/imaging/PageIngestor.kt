package com.saiteja.pdfscanner.imaging

import android.net.Uri
import com.saiteja.pdfscanner.data.DocumentRepository
import com.saiteja.pdfscanner.data.FileStore
import com.saiteja.pdfscanner.domain.Quad
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.util.UUID

/** Result of adding one or more images to a document. */
data class IngestResult(val documentId: String, val added: Int, val failed: Int)

/**
 * Turns captured/picked images into pages: normalise the image, try automatic edge detection
 * (falling back to a full-frame crop that the user can adjust), then persist the page.
 */
class PageIngestor(
    private val repository: DocumentRepository,
    private val files: FileStore,
    private val importer: ImageImporter,
    private val renderer: PageRenderer,
) {
    /** Adds a camera capture to [documentId], creating a draft when null. The temp file is deleted. */
    suspend fun addCapture(documentId: String?, captured: File): IngestResult {
        try {
            return add(documentId, listOf(Source.FromFile(captured)))
        } finally {
            captured.delete()
        }
    }

    suspend fun addUris(documentId: String?, uris: List<Uri>): IngestResult =
        add(documentId, uris.map { Source.FromUri(it) })

    private sealed interface Source {
        class FromFile(val file: File) : Source
        class FromUri(val uri: Uri) : Source
    }

    private suspend fun add(documentId: String?, sources: List<Source>): IngestResult {
        val docId = documentId ?: repository.createDraft().id
        var added = 0
        var failed = 0
        for (source in sources) {
            val pageId = UUID.randomUUID().toString()
            val fileName = "$pageId.jpg"
            val dest = files.pageFile(docId, fileName)
            try {
                when (source) {
                    is Source.FromFile -> importer.import(source.file, dest)
                    is Source.FromUri -> importer.import(source.uri, dest)
                }
                val corners = detectCorners(dest) ?: Quad.FULL
                repository.addPage(docId, fileName, corners, pageId)
                added++
            } catch (e: Exception) {
                dest.delete()
                failed++
            }
        }
        // A brand new draft with nothing in it would just be clutter.
        if (documentId == null && added == 0) repository.deleteDocument(docId)
        return IngestResult(docId, added, failed)
    }

    /** Runs edge detection on a small copy of [file]. Returns null if no document-like shape is found. */
    suspend fun detectCorners(file: File): Quad? = withContext(Dispatchers.Default) {
        runCatching {
            val bmp = renderer.decodeSource(file, DETECTION_SIDE) ?: return@runCatching null
            try {
                val scale = DETECTION_SIDE.toFloat() / maxOf(bmp.width, bmp.height)
                val w = (bmp.width * scale).toInt().coerceAtLeast(16)
                val h = (bmp.height * scale).toInt().coerceAtLeast(16)
                val small = android.graphics.Bitmap.createScaledBitmap(bmp, w, h, true)
                val px = IntArray(w * h)
                small.getPixels(px, 0, w, 0, 0, w, h)
                if (small !== bmp) small.recycle()
                EdgeDetector.detect(IntArray(w * h) { ImageFilters.luma(px[it]) }, w, h)
            } finally {
                bmp.recycle()
            }
        }.getOrNull()
    }

    companion object {
        private const val DETECTION_SIDE = 400
    }
}
