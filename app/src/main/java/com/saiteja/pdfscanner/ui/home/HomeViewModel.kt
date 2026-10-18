package com.saiteja.pdfscanner.ui.home

import android.net.Uri
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.saiteja.pdfscanner.AppContainer
import com.saiteja.pdfscanner.R
import com.saiteja.pdfscanner.domain.DocumentSummary
import com.saiteja.pdfscanner.domain.FileNames
import com.saiteja.pdfscanner.ui.UiMessage
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.io.File

data class HomeUiState(
    val loading: Boolean = true,
    val documents: List<DocumentSummary> = emptyList(),
    val totalCount: Int = 0,
    val draft: DocumentSummary? = null,
    val query: String = "",
    val busy: Boolean = false,
)

sealed interface HomeEvent {
    data class Message(val message: UiMessage) : HomeEvent
    data class OpenDocument(val documentId: String) : HomeEvent
    data class Share(val file: File, val title: String) : HomeEvent
}

class HomeViewModel(
    private val container: AppContainer,
    private val saved: SavedStateHandle,
) : ViewModel() {
    private val repository = container.repository
    private val query = saved.getStateFlow(KEY_QUERY, "")
    private val busy = MutableStateFlow(false)

    private val events = Channel<HomeEvent>(Channel.BUFFERED)
    val eventFlow = events.receiveAsFlow()

    val state: StateFlow<HomeUiState> = combine(
        repository.observeLibrary(), repository.observeDrafts(), query, busy,
    ) { library, drafts, q, isBusy ->
        HomeUiState(
            loading = false,
            documents = library.filter { FileNames.matches(it.document.name, q) },
            totalCount = library.size,
            draft = drafts.firstOrNull { it.pageCount > 0 },
            query = q,
            busy = isBusy,
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), HomeUiState(query = saved.get<String>(KEY_QUERY).orEmpty()))

    val settings = container.settings.state

    fun updateSettings(transform: (com.saiteja.pdfscanner.data.Settings) -> com.saiteja.pdfscanner.data.Settings) = container.settings.update(transform)

    fun importPdfs(uris: List<Uri>) {
        if (uris.isEmpty()) return
        viewModelScope.launch {
            busy.update { true }
            try {
                val result = container.ingestor.addPdfs(null, uris)
                if (result.protectedPdfs > 0) events.send(HomeEvent.Message(UiMessage(R.string.msg_pdf_protected, result.protectedPdfs)))
                else if (result.failed > 0) events.send(HomeEvent.Message(UiMessage(R.string.msg_pdf_import_failed, result.failed)))
                if (result.added > 0) events.send(HomeEvent.OpenDocument(result.documentId))
            } finally {
                busy.update { false }
            }
        }
    }

    fun setQuery(value: String) {
        saved[KEY_QUERY] = value
    }

    fun rename(documentId: String, name: String) = launchSafely {
        repository.rename(documentId, name)
    }

    fun delete(documentId: String) = launchSafely {
        repository.deleteDocument(documentId)
        events.send(HomeEvent.Message(UiMessage(R.string.msg_document_deleted)))
    }

    fun discardDraft(documentId: String) = launchSafely { repository.deleteDocument(documentId) }

    fun share(summary: DocumentSummary) = launchSafely {
        busy.update { true }
        try {
            val doc = summary.document
            val file = container.exporter.exportToCache(doc.id, doc.pageSize, doc.name)
            events.send(HomeEvent.Share(file, doc.name))
        } finally {
            busy.update { false }
        }
    }

    fun importPhotos(uris: List<Uri>) {
        if (uris.isEmpty()) return
        viewModelScope.launch {
            busy.update { true }
            try {
                val result = container.ingestor.addUris(null, uris)
                if (result.failed > 0) events.send(HomeEvent.Message(UiMessage(R.string.msg_some_images_failed, result.failed)))
                if (result.added > 0) events.send(HomeEvent.OpenDocument(result.documentId))
            } finally {
                busy.update { false }
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
                events.send(HomeEvent.Message(UiMessage(R.string.msg_generic_error)))
            }
        }
    }

    private companion object {
        const val KEY_QUERY = "query"
    }
}
