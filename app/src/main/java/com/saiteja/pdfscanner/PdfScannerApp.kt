package com.saiteja.pdfscanner

import android.app.Application
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class PdfScannerApp : Application() {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
        // Temp camera frames and shared PDF copies are never needed after a restart.
        CoroutineScope(Dispatchers.IO).launch { container.fileStore.clearTemporaryFiles() }
    }
}
