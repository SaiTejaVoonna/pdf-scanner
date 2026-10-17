package com.saiteja.pdfscanner.ui.document

import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.ArrowForward
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.outlined.AddAPhoto
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.FileDownload
import androidx.compose.material.icons.outlined.PhotoLibrary
import androidx.compose.material.icons.outlined.PictureAsPdf
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material3.BottomAppBar
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.saiteja.pdfscanner.R
import com.saiteja.pdfscanner.domain.FileNames
import com.saiteja.pdfscanner.domain.PdfPageSize
import com.saiteja.pdfscanner.domain.ScanPage
import com.saiteja.pdfscanner.ui.AppViewModelProvider
import com.saiteja.pdfscanner.ui.ShareSupport
import com.saiteja.pdfscanner.ui.components.ConfirmDialog
import com.saiteja.pdfscanner.ui.components.EmptyState
import com.saiteja.pdfscanner.ui.components.LocalThumbnails
import com.saiteja.pdfscanner.ui.components.PageThumbnail
import com.saiteja.pdfscanner.ui.components.RenameDialog

private const val MAX_IMPORT = 50

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DocumentScreen(
    onBack: () -> Unit,
    onAddPages: (documentId: String) -> Unit,
    onEditPage: (documentId: String, pageId: String) -> Unit,
    viewModel: DocumentViewModel = viewModel(factory = AppViewModelProvider.Factory),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val snackbar = remember { SnackbarHostState() }

    var showRename by rememberSaveable { mutableStateOf(false) }
    var showExport by rememberSaveable { mutableStateOf(false) }
    var deletePageId by rememberSaveable { mutableStateOf<String?>(null) }
    var showLeaveDraft by rememberSaveable { mutableStateOf(false) }
    var showDiscard by rememberSaveable { mutableStateOf(false) }

    val picker = rememberLauncherForActivityResult(ActivityResultContracts.PickMultipleVisualMedia(MAX_IMPORT)) { viewModel.addPhotos(it) }
    val saveLauncher = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/pdf")) { uri ->
        if (uri == null) viewModel.notifyCancelledPicker() else viewModel.saveTo(uri)
    }

    LaunchedEffect(viewModel) {
        viewModel.eventFlow.collect { event ->
            when (event) {
                is DocumentEvent.Message -> {
                    if (event.message.res == R.string.msg_pdf_saved) showExport = false
                    snackbar.showSnackbar(event.message.resolve(context))
                }
                is DocumentEvent.Share -> {
                    showExport = false
                    ShareSupport.sharePdf(context, event.file, event.title)
                }
                DocumentEvent.Close -> onBack()
            }
        }
    }
    // The document disappeared underneath us (e.g. deleted elsewhere).
    LaunchedEffect(state.loaded, state.document) {
        if (state.loaded && state.document == null) onBack()
    }

    val doc = state.document
    val isDraft = doc?.isDraft == true
    val exporting = state.export != null
    val handleBack = {
        when {
            exporting -> Unit
            isDraft && state.pages.isEmpty() -> viewModel.discard() // nothing worth keeping
            isDraft -> showLeaveDraft = true
            else -> onBack()
        }
    }
    BackHandler(onBack = handleBack)

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(
                        Modifier.clickable(enabled = doc != null, onClickLabel = stringResource(R.string.action_rename)) { showRename = true },
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(doc?.name.orEmpty(), maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false))
                        Spacer(Modifier.width(8.dp))
                        Icon(Icons.Outlined.Edit, contentDescription = stringResource(R.string.action_rename), modifier = Modifier.size(18.dp))
                    }
                },
                navigationIcon = {
                    IconButton(onClick = handleBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.action_back)) }
                },
                actions = {
                    if (isDraft) {
                        TextButton(onClick = { viewModel.saveToLibrary() }, enabled = state.pages.isNotEmpty() && !exporting) {
                            Icon(Icons.Filled.Check, null, Modifier.size(18.dp))
                            Spacer(Modifier.width(6.dp))
                            Text(stringResource(R.string.action_save_to_library))
                        }
                    }
                },
            )
        },
        bottomBar = {
            BottomAppBar(
                actions = {
                    IconButton(onClick = { doc?.let { onAddPages(it.id) } }, enabled = !exporting && !state.busy) {
                        Icon(Icons.Outlined.AddAPhoto, contentDescription = stringResource(R.string.action_add_page_camera))
                    }
                    IconButton(onClick = { picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) }, enabled = !exporting && !state.busy) {
                        Icon(Icons.Outlined.PhotoLibrary, contentDescription = stringResource(R.string.action_import_photos))
                    }
                    if (isDraft) {
                        IconButton(onClick = { showDiscard = true }, enabled = !exporting) {
                            Icon(Icons.Outlined.Delete, contentDescription = stringResource(R.string.action_discard))
                        }
                    }
                },
                floatingActionButton = {
                    ExtendedFloatingActionButton(
                        onClick = { if (!exporting && state.pages.isNotEmpty()) showExport = true },
                        icon = { Icon(Icons.Outlined.PictureAsPdf, null) },
                        text = { Text(stringResource(R.string.action_export_pdf)) },
                    )
                },
            )
        },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        Column(Modifier.padding(padding).fillMaxSize()) {
            if (state.busy) LinearProgressIndicator(Modifier.fillMaxWidth())
            when {
                !state.loaded -> Unit
                state.pages.isEmpty() -> EmptyState(
                    icon = Icons.Outlined.AddAPhoto,
                    title = stringResource(R.string.document_empty_title),
                    message = stringResource(R.string.document_empty_message),
                    modifier = Modifier.fillMaxSize(),
                ) {
                    Button(onClick = { doc?.let { onAddPages(it.id) } }) { Text(stringResource(R.string.action_add_page_camera)) }
                    Spacer(Modifier.height(8.dp))
                    OutlinedButton(onClick = { picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) }) {
                        Text(stringResource(R.string.action_import_photos))
                    }
                }
                else -> LazyVerticalGrid(
                    columns = GridCells.Adaptive(160.dp),
                    contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 24.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    modifier = Modifier.fillMaxSize(),
                ) {
                    item(span = { GridItemSpan(maxLineSpan) }) {
                        Text(
                            pluralStringResource(R.plurals.pages_count, state.pages.size, state.pages.size) + " · " + stringResource(R.string.pages_hint),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    itemsIndexed(state.pages, key = { _, p -> p.id }) { index, page ->
                        PageCard(
                            page = page,
                            index = index,
                            total = state.pages.size,
                            onEdit = { onEditPage(page.documentId, page.id) },
                            onMove = { delta -> viewModel.movePage(page.id, delta) },
                            onDelete = { deletePageId = page.id },
                        )
                    }
                }
            }
        }
    }

    if (showRename && doc != null) {
        RenameDialog(
            initial = doc.name,
            onConfirm = { viewModel.rename(it); showRename = false },
            onDismiss = { showRename = false },
        )
    }
    deletePageId?.let { id ->
        val index = state.pages.indexOfFirst { it.id == id }
        if (index < 0) deletePageId = null else ConfirmDialog(
            title = stringResource(R.string.delete_page_title),
            message = stringResource(R.string.delete_page_message, index + 1),
            confirmLabel = stringResource(R.string.action_delete),
            onConfirm = { viewModel.removePage(id); deletePageId = null },
            onDismiss = { deletePageId = null },
        )
    }
    if (showLeaveDraft) {
        LeaveDraftDialog(
            canSave = state.pages.isNotEmpty(),
            onSave = { showLeaveDraft = false; viewModel.saveToLibrary() },
            onKeep = { showLeaveDraft = false; onBack() },
            onDiscard = { showLeaveDraft = false; showDiscard = true },
            onDismiss = { showLeaveDraft = false },
        )
    }
    if (showDiscard) {
        ConfirmDialog(
            title = stringResource(R.string.discard_draft_title),
            message = stringResource(R.string.discard_draft_message),
            confirmLabel = stringResource(R.string.action_discard),
            onConfirm = { showDiscard = false; viewModel.discard() },
            onDismiss = { showDiscard = false },
        )
    }
    if (showExport && doc != null) {
        ExportSheet(
            fileName = state.exportName,
            pageSize = doc.pageSize,
            pageCount = state.pages.size,
            progress = state.export,
            onFileName = viewModel::setExportName,
            onPageSize = viewModel::setPageSize,
            onSave = { saveLauncher.launch(FileNames.pdfFileName(state.exportName.ifBlank { doc.name })) },
            onShare = viewModel::share,
            onCancelExport = viewModel::cancelExport,
            onDismiss = { if (!exporting) showExport = false },
        )
    }
}

@Composable
private fun LeaveDraftDialog(canSave: Boolean, onSave: () -> Unit, onKeep: () -> Unit, onDiscard: () -> Unit, onDismiss: () -> Unit) {
    androidx.compose.material3.AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.leave_draft_title)) },
        text = { Text(stringResource(R.string.leave_draft_message)) },
        confirmButton = {
            Row {
                TextButton(onClick = onDiscard) { Text(stringResource(R.string.action_discard), color = MaterialTheme.colorScheme.error) }
                TextButton(onClick = onKeep) { Text(stringResource(R.string.action_keep_draft)) }
                if (canSave) TextButton(onClick = onSave) { Text(stringResource(R.string.action_save)) }
            }
        },
    )
}

@Composable
private fun PageCard(page: ScanPage, index: Int, total: Int, onEdit: () -> Unit, onMove: (Int) -> Unit, onDelete: () -> Unit) {
    val label = stringResource(R.string.page_of, index + 1, total)
    val moveEarlier = stringResource(R.string.action_move_earlier)
    val moveLater = stringResource(R.string.action_move_later)
    val delete = stringResource(R.string.action_delete)
    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow),
        elevation = CardDefaults.cardElevation(1.dp),
        modifier = Modifier.semantics {
            customActions = buildList {
                if (index > 0) add(CustomAccessibilityAction(moveEarlier) { onMove(-1); true })
                if (index < total - 1) add(CustomAccessibilityAction(moveLater) { onMove(1); true })
                add(CustomAccessibilityAction(delete) { onDelete(); true })
            }
        },
    ) {
        Column {
            PageThumbnail(
                page = page,
                cache = LocalThumbnails.current,
                contentDescription = label,
                modifier = Modifier.fillMaxWidth().aspectRatio(0.75f).clip(RoundedCornerShape(topStart = 12.dp, topEnd = 12.dp))
                    .clickable(onClickLabel = stringResource(R.string.action_edit_page), onClick = onEdit),
            )
            Row(Modifier.fillMaxWidth().padding(horizontal = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(label, style = MaterialTheme.typography.labelMedium, modifier = Modifier.weight(1f).padding(start = 8.dp), maxLines = 1)
                IconButton(onClick = { onMove(-1) }, enabled = index > 0) {
                    Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = moveEarlier, modifier = Modifier.size(20.dp))
                }
                IconButton(onClick = { onMove(1) }, enabled = index < total - 1) {
                    Icon(Icons.AutoMirrored.Outlined.ArrowForward, contentDescription = moveLater, modifier = Modifier.size(20.dp))
                }
                IconButton(onClick = onDelete) {
                    Icon(Icons.Outlined.Delete, contentDescription = delete, modifier = Modifier.size(20.dp))
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ExportSheet(
    fileName: String,
    pageSize: PdfPageSize,
    pageCount: Int,
    progress: ExportProgress?,
    onFileName: (String) -> Unit,
    onPageSize: (PdfPageSize) -> Unit,
    onSave: () -> Unit,
    onShare: () -> Unit,
    onCancelExport: () -> Unit,
    onDismiss: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val working = progress != null
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState) {
        Column(Modifier.padding(horizontal = 24.dp).padding(bottom = 24.dp).navigationBarsPadding(), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Text(stringResource(R.string.export_title), style = MaterialTheme.typography.titleLarge)
            OutlinedTextField(
                value = fileName,
                onValueChange = { onFileName(it.take(100)) },
                label = { Text(stringResource(R.string.label_file_name)) },
                suffix = { Text(".pdf") },
                singleLine = true,
                enabled = !working,
                modifier = Modifier.fillMaxWidth(),
            )
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(stringResource(R.string.label_page_size), style = MaterialTheme.typography.labelLarge)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    PdfPageSize.entries.forEach { size ->
                        FilterChip(
                            selected = pageSize == size,
                            onClick = { onPageSize(size) },
                            enabled = !working,
                            label = {
                                Text(
                                    when (size) {
                                        PdfPageSize.A4 -> stringResource(R.string.size_a4)
                                        PdfPageSize.LETTER -> stringResource(R.string.size_letter)
                                        PdfPageSize.MATCH_IMAGE -> stringResource(R.string.size_match)
                                    },
                                )
                            },
                        )
                    }
                }
            }
            if (progress != null) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    LinearProgressIndicator(
                        progress = { if (progress.total == 0) 0f else progress.done.toFloat() / progress.total },
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(stringResource(R.string.export_progress, progress.done, progress.total), Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
                        TextButton(onClick = onCancelExport) { Text(stringResource(R.string.action_cancel)) }
                    }
                }
            } else {
                Text(
                    pluralStringResource(R.plurals.export_summary, pageCount, pageCount),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
                Button(onClick = onSave, enabled = !working && fileName.isNotBlank(), modifier = Modifier.weight(1f)) {
                    Icon(Icons.Outlined.FileDownload, null, Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text(stringResource(R.string.action_save_to_device))
                }
                OutlinedButton(onClick = onShare, enabled = !working && fileName.isNotBlank(), modifier = Modifier.weight(1f)) {
                    Icon(Icons.Outlined.Share, null, Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text(stringResource(R.string.action_share))
                }
            }
        }
    }
}
