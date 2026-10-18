package com.saiteja.pdfscanner.ui.tools

import android.net.Uri
import android.provider.DocumentsContract
import android.provider.OpenableColumns
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.saiteja.pdfscanner.AppContainer
import com.saiteja.pdfscanner.R
import com.saiteja.pdfscanner.domain.ImageFormat
import com.saiteja.pdfscanner.domain.ImageSizing
import com.saiteja.pdfscanner.domain.ResizePreset
import com.saiteja.pdfscanner.ui.UiMessage
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

data class ImageItem(val uri: Uri, val name: String, val sizeBytes: Long)

data class ResizeUiState(
    val images: List<ImageItem> = emptyList(),
    val preset: ResizePreset = ResizePreset.MEDIUM,
    val format: ImageFormat = ImageFormat.JPEG,
    val quality: Int = 85,
    val progress: Pair<Int, Int>? = null,
    /** "N images saved · 12.4 MB → 3.1 MB" after a successful run. */
    val summary: String? = null,
)

sealed interface ResizeEvent {
    data class Message(val message: UiMessage) : ResizeEvent
}

class ResizeViewModel(
    private val container: AppContainer,
    private val saved: SavedStateHandle,
) : ViewModel() {
    private val resolver = container.contentResolver
    private val _state = MutableStateFlow(
        ResizeUiState(
            preset = saved.get<String>(KEY_PRESET)?.let { runCatching { ResizePreset.valueOf(it) }.getOrNull() } ?: ResizePreset.MEDIUM,
            format = saved.get<String>(KEY_FORMAT)?.let { runCatching { ImageFormat.valueOf(it) }.getOrNull() } ?: ImageFormat.JPEG,
            quality = saved.get<Int>(KEY_QUALITY) ?: 85,
        ),
    )
    val state: StateFlow<ResizeUiState> = _state

    private val events = Channel<ResizeEvent>(Channel.BUFFERED)
    val eventFlow = events.receiveAsFlow()
    private var job: Job? = null

    init {
        // Restore the picked images after process death.
        val uris = saved.get<ArrayList<String>>(KEY_URIS).orEmpty().map(Uri::parse)
        if (uris.isNotEmpty()) loadItems(uris, replace = true)
    }

    fun addImages(uris: List<Uri>) {
        if (uris.isNotEmpty()) loadItems(uris, replace = false)
    }

    fun remove(uri: Uri) {
        _state.update { it.copy(images = it.images.filterNot { i -> i.uri == uri }, summary = null) }
        persistUris()
    }

    fun setPreset(p: ResizePreset) { saved[KEY_PRESET] = p.name; _state.update { it.copy(preset = p, summary = null) } }
    fun setFormat(f: ImageFormat) { saved[KEY_FORMAT] = f.name; _state.update { it.copy(format = f, summary = null) } }
    fun setQuality(q: Int) { saved[KEY_QUALITY] = q; _state.update { it.copy(quality = q, summary = null) } }

    fun cancel() { job?.cancel() }

    private fun loadItems(uris: List<Uri>, replace: Boolean) {
        viewModelScope.launch {
            val items = withContext(Dispatchers.IO) { uris.map { describe(it) } }
            _state.update { s ->
                val merged = if (replace) items else (s.images + items).distinctBy { it.uri }
                s.copy(images = merged, summary = null)
            }
            persistUris()
        }
    }

    private fun persistUris() {
        saved[KEY_URIS] = ArrayList(_state.value.images.map { it.uri.toString() })
    }

    private fun describe(uri: Uri): ImageItem {
        var name: String? = null
        var size = 0L
        runCatching {
            resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)?.use { c ->
                if (c.moveToFirst()) {
                    name = c.getString(0)
                    size = if (c.isNull(1)) 0L else c.getLong(1)
                }
            }
        }
        return ImageItem(uri, name ?: uri.lastPathSegment ?: "image", size)
    }

    /** Resizes every picked image into [folder], a directory chosen with the system folder picker. */
    fun saveTo(folder: Uri) {
        val s = _state.value
        if (s.images.isEmpty() || job?.isActive == true) return
        job = viewModelScope.launch {
            _state.update { it.copy(progress = 0 to s.images.size, summary = null) }
            var saved = 0
            var failed = 0
            var bytesIn = 0L
            var bytesOut = 0L
            try {
                val parent = DocumentsContract.buildDocumentUriUsingTree(folder, DocumentsContract.getTreeDocumentId(folder))
                val taken = HashSet<String>()
                s.images.forEachIndexed { index, item ->
                    var created: Uri? = null
                    try {
                        val name = ImageSizing.outputName(item.name, s.format, taken)
                        created = withContext(Dispatchers.IO) { DocumentsContract.createDocument(resolver, parent, s.format.mime, name) }
                            ?: throw java.io.IOException("Cannot create $name")
                        val written = withContext(Dispatchers.IO) {
                            resolver.openOutputStream(created!!)!!.buffered().use { out ->
                                container.resizer.resize(item.uri, s.preset.maxSide, s.format, s.quality, out)
                            }
                        }
                        saved++; bytesIn += item.sizeBytes; bytesOut += written
                    } catch (e: CancellationException) {
                        created?.let { runCatching { DocumentsContract.deleteDocument(resolver, it) } }
                        throw e
                    } catch (e: Exception) {
                        created?.let { runCatching { DocumentsContract.deleteDocument(resolver, it) } }
                        failed++
                    }
                    _state.update { it.copy(progress = (index + 1) to s.images.size) }
                }
                val summary = if (bytesIn > 0) "${ImageSizing.formatBytes(bytesIn)} → ${ImageSizing.formatBytes(bytesOut)}" else ImageSizing.formatBytes(bytesOut)
                _state.update { it.copy(summary = "$saved · $summary") }
                events.send(ResizeEvent.Message(UiMessage(R.string.msg_resize_done, saved, failed)))
            } catch (e: CancellationException) {
                events.send(ResizeEvent.Message(UiMessage(R.string.msg_export_cancelled)))
                throw e
            } catch (e: Exception) {
                events.send(ResizeEvent.Message(UiMessage(R.string.msg_generic_error)))
            } finally {
                _state.update { it.copy(progress = null) }
            }
        }
    }

    private companion object {
        const val KEY_URIS = "uris"
        const val KEY_PRESET = "preset"
        const val KEY_FORMAT = "format"
        const val KEY_QUALITY = "quality"
    }
}
