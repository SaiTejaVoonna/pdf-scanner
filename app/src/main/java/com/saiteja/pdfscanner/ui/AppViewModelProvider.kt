package com.saiteja.pdfscanner.ui

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModelProvider.AndroidViewModelFactory.Companion.APPLICATION_KEY
import androidx.lifecycle.createSavedStateHandle
import androidx.lifecycle.viewmodel.CreationExtras
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.saiteja.pdfscanner.AppContainer
import com.saiteja.pdfscanner.PdfScannerApp
import com.saiteja.pdfscanner.ui.camera.CameraViewModel
import com.saiteja.pdfscanner.ui.document.DocumentViewModel
import com.saiteja.pdfscanner.ui.edit.EditPageViewModel
import com.saiteja.pdfscanner.ui.home.HomeViewModel

private fun CreationExtras.container(): AppContainer = (this[APPLICATION_KEY] as PdfScannerApp).container

/** Navigation arguments arrive in the SavedStateHandle, which also survives process death. */
object AppViewModelProvider {
    val Factory = viewModelFactory {
        initializer { HomeViewModel(container(), createSavedStateHandle()) }
        initializer { CameraViewModel(container(), createSavedStateHandle()) }
        initializer { DocumentViewModel(container(), createSavedStateHandle()) }
        initializer { EditPageViewModel(container(), createSavedStateHandle()) }
    }
}

internal fun SavedStateHandle.optionalString(key: String): String? = get<String>(key)?.takeIf { it.isNotEmpty() && it != "null" }
