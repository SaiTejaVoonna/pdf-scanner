package com.saiteja.pdfscanner.ui.tools

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.outlined.AddPhotoAlternate
import androidx.compose.material.icons.outlined.FolderOpen
import androidx.compose.material.icons.outlined.PhotoSizeSelectLarge
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.saiteja.pdfscanner.R
import com.saiteja.pdfscanner.domain.ImageFormat
import com.saiteja.pdfscanner.domain.ImageSizing
import com.saiteja.pdfscanner.domain.ResizePreset
import com.saiteja.pdfscanner.ui.AppViewModelProvider
import com.saiteja.pdfscanner.ui.components.EmptyState

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ResizeScreen(onBack: () -> Unit, viewModel: ResizeViewModel = viewModel(factory = AppViewModelProvider.Factory)) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val snackbar = remember { SnackbarHostState() }

    val picker = rememberLauncherForActivityResult(ActivityResultContracts.PickMultipleVisualMedia(100)) { viewModel.addImages(it) }
    val folderPicker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocumentTree()) { uri ->
        if (uri != null) viewModel.saveTo(uri)
    }
    LaunchedEffect(viewModel) {
        viewModel.eventFlow.collect { (it as ResizeEvent.Message).let { m -> snackbar.showSnackbar(m.message.resolve(context)) } }
    }
    val working = state.progress != null
    val pickImages = { picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.action_resize_images)) },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, stringResource(R.string.action_back)) } },
                actions = {
                    if (state.images.isNotEmpty()) IconButton(onClick = pickImages, enabled = !working) {
                        Icon(Icons.Outlined.AddPhotoAlternate, stringResource(R.string.action_import_photos))
                    }
                },
            )
        },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        if (state.images.isEmpty()) {
            EmptyState(
                icon = Icons.Outlined.PhotoSizeSelectLarge,
                title = stringResource(R.string.resize_empty_title),
                message = stringResource(R.string.resize_empty_message),
                modifier = Modifier.padding(padding).fillMaxSize(),
            ) { Button(onClick = pickImages) { Text(stringResource(R.string.action_import_photos)) } }
        } else {
            Column(Modifier.padding(padding).fillMaxSize()) {
                LazyColumn(Modifier.weight(1f)) {
                    items(state.images, key = { it.uri.toString() }) { item ->
                        ListItem(
                            headlineContent = { Text(item.name, maxLines = 1) },
                            supportingContent = { if (item.sizeBytes > 0) Text(ImageSizing.formatBytes(item.sizeBytes)) },
                            trailingContent = {
                                IconButton(onClick = { viewModel.remove(item.uri) }, enabled = !working) {
                                    Icon(Icons.Filled.Close, stringResource(R.string.action_remove_image, item.name))
                                }
                            },
                        )
                    }
                }
                Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(stringResource(R.string.label_size), style = MaterialTheme.typography.labelLarge)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        ResizePreset.entries.forEach { p ->
                            FilterChip(
                                selected = state.preset == p,
                                onClick = { viewModel.setPreset(p) },
                                enabled = !working,
                                label = {
                                    Text(
                                        when (p) {
                                            ResizePreset.ORIGINAL -> stringResource(R.string.size_original)
                                            ResizePreset.LARGE -> "2048"
                                            ResizePreset.MEDIUM -> "1280"
                                            ResizePreset.SMALL -> "800"
                                        },
                                    )
                                },
                            )
                        }
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        ImageFormat.entries.forEach { f ->
                            FilterChip(selected = state.format == f, onClick = { viewModel.setFormat(f) }, enabled = !working, label = { Text(f.extension.uppercase()) })
                        }
                    }
                    if (state.format == ImageFormat.JPEG) {
                        Text(stringResource(R.string.label_jpeg_quality, state.quality), style = MaterialTheme.typography.labelLarge)
                        Slider(
                            value = state.quality.toFloat(),
                            onValueChange = { viewModel.setQuality(it.toInt()) },
                            valueRange = 40f..100f,
                            enabled = !working,
                        )
                    }
                    state.progress?.let { (done, total) ->
                        LinearProgressIndicator(progress = { if (total == 0) 0f else done.toFloat() / total }, modifier = Modifier.fillMaxWidth())
                        Row {
                            Text(stringResource(R.string.resize_progress, done, total), Modifier.weight(1f))
                            TextButton(onClick = viewModel::cancel) { Text(stringResource(R.string.action_cancel)) }
                        }
                    }
                    state.summary?.let { Text(stringResource(R.string.resize_summary, it), color = MaterialTheme.colorScheme.primary) }
                    Button(onClick = { folderPicker.launch(null) }, enabled = !working, modifier = Modifier.fillMaxWidth()) {
                        Icon(Icons.Outlined.FolderOpen, null, Modifier.size(18.dp))
                        Spacer(Modifier.width(8.dp))
                        Text(stringResource(R.string.action_save_to_folder))
                    }
                    Text(stringResource(R.string.resize_hint), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}
