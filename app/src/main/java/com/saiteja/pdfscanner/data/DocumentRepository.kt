package com.saiteja.pdfscanner.data

import androidx.room.withTransaction
import com.saiteja.pdfscanner.domain.DocumentSummary
import com.saiteja.pdfscanner.domain.FileNames
import com.saiteja.pdfscanner.domain.PageFilter
import com.saiteja.pdfscanner.domain.PageOrder
import com.saiteja.pdfscanner.domain.PdfPageSize
import com.saiteja.pdfscanner.domain.Quad
import com.saiteja.pdfscanner.domain.ScanDocument
import com.saiteja.pdfscanner.domain.ScanPage
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import java.util.UUID

/**
 * Single source of truth for documents and pages. Documents are created as drafts the moment the
 * first page is captured and become library entries once the user saves them, so an unfinished
 * scan survives configuration changes and process death.
 */
class DocumentRepository(
    private val db: AppDatabase,
    private val files: FileStore,
    private val clock: () -> Long = System::currentTimeMillis,
) {
    private val dao = db.documentDao()

    /** Saved (non-draft) documents, newest first. */
    fun observeLibrary(): Flow<List<DocumentSummary>> = summaries().map { list -> list.filterNot { it.document.isDraft } }

    /** Unfinished scans, newest first. */
    fun observeDrafts(): Flow<List<DocumentSummary>> = summaries().map { list -> list.filter { it.document.isDraft } }

    private fun summaries(): Flow<List<DocumentSummary>> =
        combine(dao.observeDocuments(), dao.observeAllPages()) { docs, pages ->
            val byDoc = pages.groupBy { it.documentId }
            docs.map { d -> DocumentSummary(d.toDomain(), byDoc[d.id].orEmpty().map { it.toDomain() }) }
        }

    fun observeDocument(id: String): Flow<ScanDocument?> = dao.observeDocument(id).map { it?.toDomain() }

    fun observePages(documentId: String): Flow<List<ScanPage>> =
        dao.observePages(documentId).map { list -> list.map { it.toDomain() } }

    suspend fun getDocument(id: String): ScanDocument? = dao.getDocument(id)?.toDomain()

    suspend fun getPages(documentId: String): List<ScanPage> = dao.getPages(documentId).map { it.toDomain() }

    suspend fun getPage(id: String): ScanPage? = dao.getPage(id)?.toDomain()

    suspend fun createDraft(name: String = FileNames.defaultDocumentName()): ScanDocument {
        val now = clock()
        val entity = DocumentEntity(newId(), name, now, now, isDraft = true, pageSize = PdfPageSize.A4.name)
        dao.insertDocument(entity)
        return entity.toDomain()
    }

    /** Appends a page whose image file already exists in the document's folder. */
    suspend fun addPage(
        documentId: String,
        sourceFile: String,
        corners: Quad = Quad.FULL,
        pageId: String = newId(),
    ): ScanPage = db.withTransaction {
        val position = dao.getPages(documentId).size
        val page = ScanPage(pageId, documentId, position, sourceFile, corners, 0, PageFilter.ORIGINAL)
        dao.insertPage(page.toEntity())
        dao.touch(documentId, clock())
        page
    }

    suspend fun updatePage(page: ScanPage) {
        dao.updatePage(page.toEntity())
        dao.touch(page.documentId, clock())
    }

    /** Removes a page, deletes its image, and closes the gap in the numbering. */
    suspend fun removePage(pageId: String) = db.withTransaction {
        val page = dao.getPage(pageId) ?: return@withTransaction
        dao.deletePage(pageId)
        files.deletePageFile(page.documentId, page.sourceFile)
        val remaining = PageOrder.remove(dao.getPages(page.documentId).map { it.id }, pageId)
        remaining.forEachIndexed { index, id -> dao.setPosition(id, index) }
        dao.touch(page.documentId, clock())
    }

    /** Moves a page to [toIndex] (0-based) within its document. */
    suspend fun movePage(documentId: String, pageId: String, toIndex: Int) = db.withTransaction {
        val ids = dao.getPages(documentId).map { it.id }
        val from = ids.indexOf(pageId)
        if (from < 0) return@withTransaction
        PageOrder.move(ids, from, toIndex).forEachIndexed { index, id -> dao.setPosition(id, index) }
        dao.touch(documentId, clock())
    }

    suspend fun movePageBy(documentId: String, pageId: String, delta: Int) {
        val ids = dao.getPages(documentId).map { it.id }
        val from = ids.indexOf(pageId)
        if (from >= 0) movePage(documentId, pageId, from + delta)
    }

    suspend fun rename(documentId: String, name: String) {
        val doc = dao.getDocument(documentId) ?: return
        dao.updateDocument(doc.copy(name = FileNames.sanitize(name, fallback = doc.name), updatedAt = clock()))
    }

    suspend fun setPageSize(documentId: String, size: PdfPageSize) {
        val doc = dao.getDocument(documentId) ?: return
        if (doc.pageSize != size.name) dao.updateDocument(doc.copy(pageSize = size.name))
    }

    /** Promotes a draft into the library. */
    suspend fun finalizeDraft(documentId: String, name: String? = null) {
        val doc = dao.getDocument(documentId) ?: return
        dao.updateDocument(
            doc.copy(
                isDraft = false,
                name = name?.let { FileNames.sanitize(it, fallback = doc.name) } ?: doc.name,
                updatedAt = clock(),
            ),
        )
    }

    suspend fun deleteDocument(documentId: String) {
        dao.deleteDocument(documentId) // pages cascade
        files.deleteDocumentFiles(documentId)
    }

    private fun newId() = UUID.randomUUID().toString()
}
