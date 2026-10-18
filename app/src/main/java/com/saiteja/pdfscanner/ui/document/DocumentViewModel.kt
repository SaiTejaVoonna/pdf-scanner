package com.saiteja.pdfscanner.ui.document

import android.net.Uri
import android.provider.DocumentsContract
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.saiteja.pdfscanner.AppContainer
import com.saiteja.pdfscanner.R
import com.saiteja.pdfscanner.domain.FileNames
import com.saiteja.pdfscanner.domain.PageFilter
import com.saiteja.pdfscanner.domain.PdfPageSize
import com.saiteja.pdfscanner.domain.PdfQuality
import com.saiteja.pdfscanner.domain.Quad
import com.saiteja.pdfscanner.domain.ScanDocument
import com.saiteja.pdfscanner.domain.ScanPage
import com.saiteja.pdfscanner.pdf.ExportException
import com.saiteja.pdfscanner.ui.UiMessage
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.io.IOException

data class ExportProgress(val done: Int, val total: Int)

data class DocumentUiState(
    val loaded: Boolean = false,
    val document: ScanDocument? = null,
    val pages: List<ScanPage> = emptyList(),
    val busy: Boolean = false,
    val export: ExportProgress? = null,
    val exportName: String = "",
    /** Pages currently selected for a bulk action; empty means normal (non-selection) mode. */
    val selection: Set<String> = emptySet(),
    val quality: PdfQuality = PdfQuality.HIGH,
)

sealed interface DocumentEvent {
    data class Message(val message: UiMessage) : DocumentEvent
    data class Share(val file: File, val title: String) : DocumentEvent
    /** The document was saved to the library or discarded; leave the screen. */
    data object Close : DocumentEvent
}

class DocumentViewModel(
    private val container: AppContainer,
    private val saved: SavedStateHandle,
) : ViewModel() {
    val documentId: String = checkNotNull(saved.get<String>("docId")) { "docId missing" }
    private val repository = container.repository

    private val busy = MutableStateFlow(false)
    private val export = MutableStateFlow<ExportProgress?>(null)
    private val exportName = saved.getStateFlow<String?>(KEY_EXPORT_NAME, null)
    private var exportJob: Job? = null

    private val events = Channel<DocumentEvent>(Channel.BUFFERED)
    val eventFlow = events.receiveAsFlow()

    private val selected = saved.getStateFlow<ArrayList<String>>(KEY_SELECTED, ArrayList())
    private val quality = saved.getStateFlow(KEY_QUALITY, PdfQuality.HIGH.name)

    private class Bits(val busy: Boolean, val export: ExportProgress?, val name: String?, val selected: List<String>, val quality: String)

    private val bits = combine(busy, export, exportName, selected, quality) { b, e, n, sel, q -> Bits(b, e, n, sel, q) }

    val state: StateFlow<DocumentUiState> = combine(
        repository.observeDocument(documentId), repository.observePages(documentId), bits,
    ) { doc, pages, b ->
        val ids = pages.mapTo(HashSet()) { it.id }
        DocumentUiState(
            loaded = true,
            document = doc,
            pages = pages,
            busy = b.busy,
            export = b.export,
            exportName = b.name ?: doc?.name.orEmpty(),
            selection = b.selected.filterTo(LinkedHashSet()) { it in ids },
            quality = runCatching { PdfQuality.valueOf(b.quality) }.getOrDefault(PdfQuality.HIGH),
        )
    // Eager: the actions below read state.value, so it must stay current even when nothing is collecting.
    }.stateIn(viewModelScope, SharingStarted.Eagerly, DocumentUiState())

    // --- selection (long-press a page to start) ---------------------------------------------------

    fun toggleSelection(pageId: String) {
        val current = ArrayList(selected.value)
        if (!current.remove(pageId)) current.add(pageId)
        saved[KEY_SELECTED] = current
    }

    fun selectAll() {
        saved[KEY_SELECTED] = ArrayList(state.value.pages.map { it.id })
    }

    fun clearSelection() {
        saved[KEY_SELECTED] = ArrayList<String>()
    }

    private fun selectedPages(): List<ScanPage> = state.value.pages.filter { it.id in state.value.selection }

    fun applyFilterToSelection(filter: PageFilter) {
        val ids = state.value.selection
        launchSafely { repository.editPages(ids) { it.copy(filter = filter) } }
    }

    fun rotateSelection(clockwise: Boolean) {
        val ids = state.value.selection
        val delta = if (clockwise) 90 else 270
        launchSafely { repository.editPages(ids) { it.copy(rotation = (it.rotation + delta) % 360) } }
    }

    /** Removes any crop on the selected pages, restoring the full image. */
    fun resetCropOfSelection() {
        val ids = state.value.selection
        launchSafely { repository.editPages(ids) { it.copy(corners = Quad.FULL) } }
    }

    /** Runs edge detection on each selected page; pages where nothing convincing is found are left unchanged. */
    fun autoCropSelection() {
        val targets = selectedPages()
        if (targets.isEmpty()) return
        launchSafely {
            busy.update { true }
            try {
                val detected = HashMap<String, Quad>()
                for (page in targets) {
                    container.ingestor.detectCorners(container.renderer.sourceFile(page))?.let { detected[page.id] = it }
                }
                repository.editPages(detected.keys) { it.copy(corners = detected.getValue(it.id)) }
                events.send(DocumentEvent.Message(UiMessage(R.string.msg_autocrop_result, detected.size, targets.size)))
            } finally {
                busy.update { false }
            }
        }
    }

    fun deleteSelection() = launchSafely {
        val ids = state.value.selection
        repository.removePages(ids)
        clearSelection()
    }

    fun setQuality(q: PdfQuality) {
        saved[KEY_QUALITY] = q.name
    }

    fun addPdfs(uris: List<Uri>) {
        if (uris.isEmpty()) return
        launchSafely {
            busy.update { true }
            try {
                val result = container.ingestor.addPdfs(documentId, uris)
                if (result.protectedPdfs > 0) events.send(DocumentEvent.Message(UiMessage(R.string.msg_pdf_protected, result.protectedPdfs)))
                else if (result.failed > 0) events.send(DocumentEvent.Message(UiMessage(R.string.msg_pdf_import_failed, result.failed)))
            } finally {
                busy.update { false }
            }
        }
    }

    fun rename(name: String) = launchSafely {
        repository.rename(documentId, name)
        saved[KEY_EXPORT_NAME] = null
    }

    fun setExportName(name: String) {
        saved[KEY_EXPORT_NAME] = name
    }

    fun setPageSize(size: PdfPageSize) = launchSafely { repository.setPageSize(documentId, size) }

    fun movePage(pageId: String, delta: Int) = launchSafely { repository.movePageBy(documentId, pageId, delta) }

    fun removePage(pageId: String) = launchSafely { repository.removePage(pageId) }

    fun addPhotos(uris: List<Uri>) {
        if (uris.isEmpty()) return
        launchSafely {
            busy.update { true }
            try {
                val result = container.ingestor.addUris(documentId, uris)
                if (result.failed > 0) events.send(DocumentEvent.Message(UiMessage(R.string.msg_some_images_failed, result.failed)))
            } finally {
                busy.update { false }
            }
        }
    }

    /** Moves a draft into the library. */
    fun saveToLibrary() = launchSafely {
        repository.finalizeDraft(documentId)
        events.send(DocumentEvent.Close)
    }

    fun discard() = launchSafely {
        repository.deleteDocument(documentId)
        events.send(DocumentEvent.Close)
    }

    /** Writes the PDF to a location chosen through the Storage Access Framework. */
    fun saveTo(uri: Uri) {
        val doc = state.value.document ?: return
        val resolver = container.contentResolver
        startExport {
            withContext(Dispatchers.IO) {
                try {
                    val stream = resolver.openOutputStream(uri, "wt") ?: throw IOException("Cannot open destination")
                    stream.buffered().use { out ->
                        container.exporter.export(doc.id, doc.pageSize, exportTitle(), out, state.value.quality) { done, total ->
                            export.value = ExportProgress(done, total)
                        }
                    }
                } catch (t: Throwable) {
                    // Don't leave a truncated PDF behind in the user's chosen folder.
                    runCatching { DocumentsContract.deleteDocument(resolver, uri) }
                    throw t
                }
            }
            events.send(DocumentEvent.Message(UiMessage(R.string.msg_pdf_saved)))
        }
    }

    fun share() {
        val doc = state.value.document ?: return
        startExport {
            val file = container.exporter.exportToCache(doc.id, doc.pageSize, exportTitle(), state.value.quality) { done, total ->
                export.value = ExportProgress(done, total)
            }
            events.send(DocumentEvent.Share(file, exportTitle()))
        }
    }

    fun cancelExport() {
        exportJob?.cancel()
    }

    fun notifyCancelledPicker() {
        events.trySend(DocumentEvent.Message(UiMessage(R.string.msg_save_cancelled)))
    }

    fun exportTitle(): String = FileNames.sanitize(state.value.exportName.ifBlank { state.value.document?.name.orEmpty() })

    private fun startExport(block: suspend () -> Unit) {
        if (exportJob?.isActive == true) return
        exportJob = viewModelScope.launch {
            export.value = ExportProgress(0, state.value.pages.size)
            try {
                block()
            } catch (e: CancellationException) {
                events.send(DocumentEvent.Message(UiMessage(R.string.msg_export_cancelled)))
                throw e
            } catch (e: ExportException) {
                events.send(DocumentEvent.Message(UiMessage(R.string.msg_export_failed, e.message.orEmpty())))
            } catch (e: IOException) {
                events.send(DocumentEvent.Message(UiMessage(R.string.msg_export_failed, e.message.orEmpty())))
            } catch (e: Exception) {
                events.send(DocumentEvent.Message(UiMessage(R.string.msg_export_failed, e.message.orEmpty())))
            } finally {
                export.value = null
            }
        }
    }

    private fun launchSafely(block: suspend () -> Unit) {
        viewModelScope.launch {
            try {
                block()
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                events.send(DocumentEvent.Message(UiMessage(R.string.msg_generic_error)))
            }
        }
    }

    private companion object {
        const val KEY_EXPORT_NAME = "exportName"
        const val KEY_SELECTED = "selected"
        const val KEY_QUALITY = "quality"
    }
}
