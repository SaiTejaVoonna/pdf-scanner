package com.saiteja.pdfscanner.data

import android.content.Context
import java.io.File

/**
 * All on-disk locations. Scans live in app-private storage (not visible to other apps, excluded
 * from backups); share/export copies live in the cache directory and can be cleared at any time.
 */
class FileStore(context: Context) {
    private val appContext = context.applicationContext

    private val documentsRoot: File get() = File(appContext.filesDir, "documents").also { it.mkdirs() }
    val captureDir: File get() = File(appContext.cacheDir, "captures").also { it.mkdirs() }
    val exportDir: File get() = File(appContext.cacheDir, "exports").also { it.mkdirs() }
    val thumbnailDir: File get() = File(appContext.cacheDir, "thumbnails").also { it.mkdirs() }

    fun documentDir(documentId: String): File = File(documentsRoot, documentId).also { it.mkdirs() }

    fun pageFile(documentId: String, fileName: String): File = File(documentDir(documentId), fileName)

    fun deleteDocumentFiles(documentId: String) {
        File(documentsRoot, documentId).deleteRecursively()
    }

    fun deletePageFile(documentId: String, fileName: String) {
        File(documentsRoot, documentId).resolve(fileName).delete()
    }

    /** Removes leftovers from earlier sessions (temporary camera files and exported copies). */
    fun clearTemporaryFiles() {
        captureDir.listFiles()?.forEach { it.delete() }
        exportDir.listFiles()?.forEach { it.delete() }
    }
}
