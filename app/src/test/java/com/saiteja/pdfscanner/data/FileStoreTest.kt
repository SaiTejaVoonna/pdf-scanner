package com.saiteja.pdfscanner.data

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class FileStoreTest {
    private val store = FileStore(ApplicationProvider.getApplicationContext<Context>())

    @Test
    fun `cleanup removes only stale temporary files`() {
        val old = java.io.File(store.captureDir, "old.jpg").apply { writeText("x"); setLastModified(System.currentTimeMillis() - 3_600_000) }
        val oldExport = java.io.File(store.exportDir, "old.pdf").apply { writeText("x"); setLastModified(System.currentTimeMillis() - 3_600_000) }
        val fresh = java.io.File(store.captureDir, "fresh.jpg").apply { writeText("x") }
        store.clearTemporaryFiles()
        assertFalse(old.exists())
        assertFalse(oldExport.exists())
        assertTrue("a capture that just started must survive", fresh.exists())
    }

    @Test
    fun `page files live under the document folder and deleting the document removes them`() {
        val f = store.pageFile("doc1", "p.jpg").apply { writeText("x") }
        assertTrue(f.parentFile!!.name == "doc1")
        store.deleteDocumentFiles("doc1")
        assertFalse(f.exists())
    }
}
