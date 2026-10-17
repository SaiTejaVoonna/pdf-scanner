package com.saiteja.pdfscanner.ui.edit

import android.graphics.Bitmap
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.saiteja.pdfscanner.AppContainer
import com.saiteja.pdfscanner.R
import com.saiteja.pdfscanner.domain.PageFilter
import com.saiteja.pdfscanner.domain.Pt
import com.saiteja.pdfscanner.domain.Quad
import com.saiteja.pdfscanner.domain.ScanPage
import com.saiteja.pdfscanner.domain.toFloats
import com.saiteja.pdfscanner.ui.UiMessage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

enum class EditStep { CROP, ENHANCE }

data class EditUiState(
    val loading: Boolean = true,
    val failed: Boolean = false,
    val source: Bitmap? = null,
    val corners: Quad = Quad.FULL,
    val rotation: Int = 0,
    val filter: PageFilter = PageFilter.ORIGINAL,
    val step: EditStep = EditStep.CROP,
    val preview: Bitmap? = null,
    val rendering: Boolean = false,
    val detecting: Boolean = false,
    val dirty: Boolean = false,
)

sealed interface EditEvent {
    data class Message(val message: UiMessage) : EditEvent
    data object Saved : EditEvent
}

class EditPageViewModel(
    private val container: AppContainer,
    private val saved: SavedStateHandle,
) : ViewModel() {
    private val pageId: String = checkNotNull(saved.get<String>("pageId")) { "pageId missing" }

    private val _state = MutableStateFlow(EditUiState())
    val state: StateFlow<EditUiState> = _state

    private val events = Channel<EditEvent>(Channel.BUFFERED)
    val eventFlow = events.receiveAsFlow()

    private var page: ScanPage? = null

    init {
        viewModelScope.launch { load() }
        // Re-render the result preview whenever its inputs change; older renders are cancelled.
        viewModelScope.launch {
            _state.map { s -> RenderKey(s.step, s.corners, s.rotation, s.filter, s.loading) }
                .distinctUntilChanged() // our own rendering/preview updates must not retrigger a render
                .collectLatest { key ->
                    if (key.loading || key.step != EditStep.ENHANCE) return@collectLatest
                    renderPreview(key)
                }
        }
    }

    private data class RenderKey(val step: EditStep, val corners: Quad, val rotation: Int, val filter: PageFilter, val loading: Boolean)

    private suspend fun load() {
        val loadedPage = container.repository.getPage(pageId)
        if (loadedPage == null) {
            _state.update { it.copy(loading = false, failed = true) }
            return
        }
        page = loadedPage
        val file = container.renderer.sourceFile(loadedPage)
        val source = withContext(Dispatchers.Default) { runCatching { container.renderer.decodeSource(file, PREVIEW_SIDE) }.getOrNull() }
        if (source == null) {
            _state.update { it.copy(loading = false, failed = true) }
            return
        }
        val restoredCorners = saved.get<FloatArray>(KEY_CORNERS)?.let { Quad.fromFloats(it) }
        _state.update {
            it.copy(
                loading = false,
                source = source,
                corners = restoredCorners ?: loadedPage.corners,
                rotation = saved.get<Int>(KEY_ROTATION) ?: loadedPage.rotation,
                filter = saved.get<String>(KEY_FILTER)?.let { n -> runCatching { PageFilter.valueOf(n) }.getOrNull() } ?: loadedPage.filter,
                step = saved.get<String>(KEY_STEP)?.let { n -> runCatching { EditStep.valueOf(n) }.getOrNull() } ?: EditStep.CROP,
                dirty = restoredCorners != null || saved.contains(KEY_ROTATION) || saved.contains(KEY_FILTER),
            )
        }
    }

    private suspend fun renderPreview(key: RenderKey) {
        val p = page ?: return
        if (!key.corners.isValidCrop()) return
        _state.update { it.copy(rendering = true) }
        try {
            val bitmap = withContext(Dispatchers.Default) {
                runCatching {
                    container.renderer.render(container.renderer.sourceFile(p), key.corners, key.rotation, key.filter, RESULT_PREVIEW_SIDE)
                }.getOrNull()
            }
            _state.update { it.copy(preview = bitmap ?: it.preview) }
            if (bitmap == null) events.send(EditEvent.Message(UiMessage(R.string.msg_preview_failed)))
        } finally {
            _state.update { it.copy(rendering = false) }
        }
    }

    fun setStep(step: EditStep) {
        saved[KEY_STEP] = step.name
        if (step == EditStep.ENHANCE && !_state.value.corners.isValidCrop()) {
            events.trySend(EditEvent.Message(UiMessage(R.string.msg_invalid_crop)))
            return
        }
        _state.update { it.copy(step = step) }
    }

    fun moveCorner(index: Int, to: Pt) = updateCorners { it.withPoint(index, Pt(to.x.coerceIn(0f, 1f), to.y.coerceIn(0f, 1f))) }

    fun resetCorners() = updateCorners { Quad.FULL }

    fun autoDetect() {
        val p = page ?: return
        viewModelScope.launch {
            _state.update { it.copy(detecting = true) }
            try {
                val found = container.ingestor.detectCorners(container.renderer.sourceFile(p))
                if (found == null) {
                    events.send(EditEvent.Message(UiMessage(R.string.msg_no_edges_found)))
                } else {
                    updateCorners { found }
                }
            } finally {
                _state.update { it.copy(detecting = false) }
            }
        }
    }

    fun rotate(clockwise: Boolean) {
        val next = (_state.value.rotation + if (clockwise) 90 else 270) % 360
        saved[KEY_ROTATION] = next
        _state.update { it.copy(rotation = next, dirty = true) }
    }

    fun setFilter(filter: PageFilter) {
        saved[KEY_FILTER] = filter.name
        _state.update { it.copy(filter = filter, dirty = true) }
    }

    fun save() {
        val p = page ?: return
        val s = _state.value
        if (!s.corners.isValidCrop()) {
            events.trySend(EditEvent.Message(UiMessage(R.string.msg_invalid_crop)))
            return
        }
        viewModelScope.launch {
            try {
                container.repository.updatePage(p.copy(corners = s.corners.coerceIn01(), rotation = s.rotation, filter = s.filter))
                events.send(EditEvent.Saved)
            } catch (e: Exception) {
                events.send(EditEvent.Message(UiMessage(R.string.msg_generic_error)))
            }
        }
    }

    private fun updateCorners(transform: (Quad) -> Quad) {
        val next = transform(_state.value.corners)
        saved[KEY_CORNERS] = next.toFloats()
        _state.update { it.copy(corners = next, dirty = true) }
    }

    private companion object {
        const val KEY_CORNERS = "corners"
        const val KEY_ROTATION = "rotation"
        const val KEY_FILTER = "filter"
        const val KEY_STEP = "step"
        const val PREVIEW_SIDE = 1600
        const val RESULT_PREVIEW_SIDE = 1400
    }
}
