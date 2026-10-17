package com.saiteja.pdfscanner

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Color
import androidx.test.core.app.ApplicationProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import kotlinx.coroutines.withTimeout
import java.io.FileOutputStream

/** Shared setup for tests that need the real app wiring (Room on Robolectric, native bitmaps). */
@OptIn(ExperimentalCoroutinesApi::class)
object TestFixtures {
    fun container(): AppContainer = AppContainer(ApplicationProvider.getApplicationContext<Context>())

    fun useUnconfinedMain() = Dispatchers.setMain(UnconfinedTestDispatcher())

    fun resetMain() = Dispatchers.resetMain()

    /** Creates a document with [pages] pages (ids "<name>-0", "<name>-1", ...). */
    suspend fun seedDocument(container: AppContainer, name: String, pages: Int, finalized: Boolean = true): String {
        val doc = container.repository.createDraft(name)
        repeat(pages) { i ->
            val file = "$name-$i.jpg"
            val bmp = Bitmap.createBitmap(300, 400, Bitmap.Config.ARGB_8888)
            bmp.eraseColor(Color.rgb(200, 200, 190))
            FileOutputStream(container.fileStore.pageFile(doc.id, file)).use { bmp.compress(Bitmap.CompressFormat.JPEG, 90, it) }
            bmp.recycle()
            container.repository.addPage(doc.id, file, pageId = "$name-$i")
        }
        if (finalized) container.repository.finalizeDraft(doc.id)
        return doc.id
    }

    suspend fun <T> Flow<T>.awaitMatch(timeoutMs: Long = 15_000, predicate: (T) -> Boolean): T =
        withTimeout(timeoutMs) { first(predicate) }
}
