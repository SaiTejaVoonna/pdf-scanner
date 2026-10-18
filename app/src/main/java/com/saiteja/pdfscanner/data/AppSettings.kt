package com.saiteja.pdfscanner.data

import android.content.Context
import com.saiteja.pdfscanner.domain.PageFilter
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

/** Small user preferences, kept in SharedPreferences and exposed as a [StateFlow] for the UI. */
data class Settings(
    /** Try to find the page edges automatically on photos taken with the camera. */
    val autoCropCamera: Boolean = true,
    /** Same for images imported from the gallery; off by default because shared images are rarely tilted pages. */
    val autoCropImport: Boolean = false,
    /** Filter applied to newly added pages. */
    val defaultFilter: PageFilter = PageFilter.ORIGINAL,
)

class AppSettings(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences("settings", Context.MODE_PRIVATE)

    private val _state = MutableStateFlow(load())
    val state: StateFlow<Settings> = _state

    val current: Settings get() = _state.value

    fun update(transform: (Settings) -> Settings) {
        val next = transform(_state.value)
        prefs.edit()
            .putBoolean(KEY_CAMERA, next.autoCropCamera)
            .putBoolean(KEY_IMPORT, next.autoCropImport)
            .putString(KEY_FILTER, next.defaultFilter.name)
            .apply()
        _state.value = next
    }

    private fun load() = Settings(
        autoCropCamera = prefs.getBoolean(KEY_CAMERA, true),
        autoCropImport = prefs.getBoolean(KEY_IMPORT, false),
        defaultFilter = prefs.getString(KEY_FILTER, null)
            ?.let { runCatching { PageFilter.valueOf(it) }.getOrNull() }
            ?.takeIf { it == PageFilter.ORIGINAL || it == PageFilter.ENHANCED }
            ?: PageFilter.ORIGINAL,
    )

    private companion object {
        const val KEY_CAMERA = "auto_crop_camera"
        const val KEY_IMPORT = "auto_crop_import"
        const val KEY_FILTER = "default_filter"
    }
}
