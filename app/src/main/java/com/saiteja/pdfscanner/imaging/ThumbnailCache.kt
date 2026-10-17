package com.saiteja.pdfscanner.imaging

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.LruCache
import com.saiteja.pdfscanner.data.FileStore
import com.saiteja.pdfscanner.domain.ScanPage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream

/** Memory + disk cache of rendered page thumbnails, keyed by the page's edit state. */
class ThumbnailCache(private val renderer: PageRenderer, private val files: FileStore) {

    private val memory = object : LruCache<String, Bitmap>(24 * 1024 * 1024) {
        override fun sizeOf(key: String, value: Bitmap) = value.byteCount
    }

    fun cached(page: ScanPage): Bitmap? = memory.get(page.renderKey)

    suspend fun load(page: ScanPage): Bitmap? = withContext(Dispatchers.Default) {
        memory.get(page.renderKey)?.let { return@withContext it }
        val diskFile = File(files.thumbnailDir, "${page.renderKey}.jpg")
        val bitmap = (if (diskFile.exists()) BitmapFactory.decodeFile(diskFile.path) else null)
            ?: runCatching {
                renderer.render(page, THUMBNAIL_SIDE).also { rendered ->
                    runCatching { FileOutputStream(diskFile).use { rendered.compress(Bitmap.CompressFormat.JPEG, 80, it) } }
                }
            }.getOrNull()
        bitmap?.also { memory.put(page.renderKey, it) }
    }

    companion object {
        const val THUMBNAIL_SIDE = 480
    }
}
