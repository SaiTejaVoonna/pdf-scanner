package com.saiteja.pdfscanner

import android.content.ContentResolver
import android.content.Context
import androidx.room.Room
import com.saiteja.pdfscanner.data.AppDatabase
import com.saiteja.pdfscanner.data.AppSettings
import com.saiteja.pdfscanner.data.DocumentRepository
import com.saiteja.pdfscanner.data.FileStore
import com.saiteja.pdfscanner.imaging.ImageImporter
import com.saiteja.pdfscanner.imaging.ImageResizer
import com.saiteja.pdfscanner.imaging.PageIngestor
import com.saiteja.pdfscanner.imaging.PageRenderer
import com.saiteja.pdfscanner.imaging.PdfPageImporter
import com.saiteja.pdfscanner.imaging.ThumbnailCache
import com.saiteja.pdfscanner.pdf.PdfExporter

/** Hand-wired dependency graph; small enough that a DI framework would add more than it removes. */
class AppContainer(context: Context) {
    private val appContext = context.applicationContext
    val contentResolver: ContentResolver = appContext.contentResolver
    val fileStore = FileStore(appContext)
    val settings = AppSettings(appContext)
    private val database: AppDatabase = Room.databaseBuilder(appContext, AppDatabase::class.java, "pdfscanner.db").build()
    val repository = DocumentRepository(database, fileStore)
    val renderer = PageRenderer(fileStore)
    val thumbnails = ThumbnailCache(renderer, fileStore)
    val importer = ImageImporter(appContext)
    val ingestor = PageIngestor(repository, fileStore, importer, renderer, settings, PdfPageImporter(contentResolver))
    val resizer = ImageResizer(contentResolver, importer)
    val exporter = PdfExporter(repository, renderer, fileStore)
}
