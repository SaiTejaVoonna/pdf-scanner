package com.saiteja.pdfscanner

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import com.saiteja.pdfscanner.ui.AppNavigation
import com.saiteja.pdfscanner.ui.components.LocalThumbnails
import com.saiteja.pdfscanner.ui.theme.PdfScannerTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val container = (application as PdfScannerApp).container
        setContent {
            PdfScannerTheme {
                CompositionLocalProvider(LocalThumbnails provides container.thumbnails) {
                    Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                        AppNavigation()
                    }
                }
            }
        }
    }
}
