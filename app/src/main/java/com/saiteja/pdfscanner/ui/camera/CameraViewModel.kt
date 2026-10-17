package com.saiteja.pdfscanner.ui.camera

import android.net.Uri
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.saiteja.pdfscanner.AppContainer
import com.saiteja.pdfscanner.R
import com.saiteja.pdfscanner.domain.ScanPage
import com.saiteja.pdfscanner.imaging.IngestResult
import com.saiteja.pdfscanner.ui.UiMessage
import com.saiteja.pdfscanner.ui.optionalString
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.io.File

@OptIn(ExperimentalCoroutinesApi::class)
class CameraViewModel(
    private val container: AppContainer,
    private val saved: SavedStateHandle,
) : ViewModel() {

    /** Null until the first page exists; then the (draft) document pages are added to. */
    private val documentId = saved.getStateFlow<String?>(KEY_DOC, saved.optionalString(KEY_DOC))
    val currentDocumentId: String? get() = documentId.value

    private val _busy = MutableStateFlow(false)
    val busy: StateFlow<Boolean> = _busy

    private val _messages = Channel<UiMessage>(Channel.BUFFERED)
    val messages = _messages.receiveAsFlow()

    val pages: StateFlow<List<ScanPage>> = documentId
        .flatMapLatest { id -> if (id == null) flowOf(emptyList()) else container.repository.observePages(id) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    /** A scratch file for CameraX to write a capture into. */
    fun newCaptureFile(): File = File(container.fileStore.captureDir, "capture-${System.nanoTime()}.jpg")

    fun onCaptured(file: File) {
        viewModelScope.launch {
            _busy.update { true }
            try {
                report(container.ingestor.addCapture(documentId.value, file))
            } finally {
                _busy.update { false }
            }
        }
    }

    fun onCaptureFailed() {
        _messages.trySend(UiMessage(R.string.msg_capture_failed))
    }

    fun onImported(uris: List<Uri>) {
        if (uris.isEmpty()) return
        viewModelScope.launch {
            _busy.update { true }
            try {
                report(container.ingestor.addUris(documentId.value, uris))
            } finally {
                _busy.update { false }
            }
        }
    }

    private fun report(result: IngestResult) {
        if (result.added > 0) saved[KEY_DOC] = result.documentId
        if (result.failed > 0) _messages.trySend(UiMessage(R.string.msg_some_images_failed, result.failed))
    }

    private companion object {
        const val KEY_DOC = "docId"
    }
}
