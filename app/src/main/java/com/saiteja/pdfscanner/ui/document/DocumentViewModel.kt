package com.saiteja.pdfscanner.ui.document

import android.net.Uri
import android.provider.DocumentsContract
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.saiteja.pdfscanner.AppContainer
import com.saiteja.pdfscanner.R
import com.saiteja.pdfscanner.domain.FileNames
import com.saiteja.pdfscanner.domain.PdfPageSize
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

    val state: StateFlow<DocumentUiState> = combine(
        repository.observeDocument(documentId), repository.observePages(documentId), busy, export, exportName,
    ) { doc, pages, isBusy, progress, name ->
        DocumentUiState(
            loaded = true,
            document = doc,
            pages = pages,
            busy = isBusy,
            export = progress,
            exportName = name ?: doc?.name.orEmpty(),
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), DocumentUiState())

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
                        container.exporter.export(doc.id, doc.pageSize, exportTitle(), out) { done, total ->
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
            val file = container.exporter.exportToCache(doc.id, doc.pageSize, exportTitle()) { done, total ->
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
    }
}
