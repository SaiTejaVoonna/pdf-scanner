package com.saiteja.pdfscanner.ui.home

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.outlined.CameraAlt
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.DocumentScanner
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.PhotoLibrary
import androidx.compose.material.icons.outlined.SearchOff
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.draw.clip
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.saiteja.pdfscanner.R
import com.saiteja.pdfscanner.domain.DocumentSummary
import com.saiteja.pdfscanner.ui.AppViewModelProvider
import com.saiteja.pdfscanner.ui.ShareSupport
import com.saiteja.pdfscanner.ui.components.ConfirmDialog
import com.saiteja.pdfscanner.ui.components.EmptyState
import com.saiteja.pdfscanner.ui.components.LocalThumbnails
import com.saiteja.pdfscanner.ui.components.PageThumbnail
import com.saiteja.pdfscanner.ui.components.RenameDialog
import java.text.DateFormat
import java.util.Date

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    onScan: () -> Unit,
    onOpenDocument: (String) -> Unit,
    onResumeDraft: (String) -> Unit,
    viewModel: HomeViewModel = viewModel(factory = AppViewModelProvider.Factory),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val snackbar = remember { SnackbarHostState() }

    var renameTarget by rememberSaveable { mutableStateOf<String?>(null) }
    var deleteTarget by rememberSaveable { mutableStateOf<String?>(null) }
    var discardDraft by rememberSaveable { mutableStateOf(false) }

    val picker = rememberLauncherForActivityResult(ActivityResultContracts.PickMultipleVisualMedia(MAX_IMPORT)) { uris ->
        viewModel.importPhotos(uris)
    }

    LaunchedEffect(viewModel) {
        viewModel.eventFlow.collect { event ->
            when (event) {
                is HomeEvent.Message -> snackbar.showSnackbar(event.message.resolve(context))
                is HomeEvent.OpenDocument -> onOpenDocument(event.documentId)
                is HomeEvent.Share -> ShareSupport.sharePdf(context, event.file, event.title)
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.app_name)) },
                actions = {
                    IconButton(onClick = { picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) }) {
                        Icon(Icons.Outlined.PhotoLibrary, contentDescription = stringResource(R.string.action_import_photos))
                    }
                },
            )
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = onScan,
                icon = { Icon(Icons.Outlined.CameraAlt, contentDescription = null) },
                text = { Text(stringResource(R.string.action_scan)) },
            )
        },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        Column(Modifier.padding(padding).fillMaxSize()) {
            if (state.busy) LinearProgressIndicator(Modifier.fillMaxWidth())
            when {
                state.loading -> Unit
                state.totalCount == 0 && state.draft == null -> EmptyState(
                    icon = Icons.Outlined.DocumentScanner,
                    title = stringResource(R.string.home_empty_title),
                    message = stringResource(R.string.home_empty_message),
                    // Keep the content clear of the Scan button, even on short screens.
                    modifier = Modifier.fillMaxSize().padding(bottom = 88.dp),
                ) {
                    FilledTonalButton(onClick = onScan) {
                        Icon(Icons.Outlined.CameraAlt, null, Modifier.size(18.dp))
                        Spacer(Modifier.width(8.dp))
                        Text(stringResource(R.string.action_scan_document))
                    }
                    Spacer(Modifier.height(8.dp))
                    OutlinedButton(onClick = { picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) }) {
                        Icon(Icons.Outlined.PhotoLibrary, null, Modifier.size(18.dp))
                        Spacer(Modifier.width(8.dp))
                        Text(stringResource(R.string.action_import_photos))
                    }
                }
                else -> {
                    val keyboard = LocalSoftwareKeyboardController.current
                    OutlinedTextField(
                        value = state.query,
                        onValueChange = viewModel::setQuery,
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                        singleLine = true,
                        shape = RoundedCornerShape(28.dp),
                        placeholder = { Text(stringResource(R.string.search_hint)) },
                        leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
                        trailingIcon = {
                            if (state.query.isNotEmpty()) {
                                IconButton(onClick = { viewModel.setQuery("") }) {
                                    Icon(Icons.Filled.Clear, contentDescription = stringResource(R.string.action_clear_search))
                                }
                            }
                        },
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                        keyboardActions = androidx.compose.foundation.text.KeyboardActions(onSearch = { keyboard?.hide() }),
                    )
                    LazyColumn(
                        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 4.dp, bottom = 96.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                        modifier = Modifier.fillMaxSize(),
                    ) {
                        state.draft?.let { draft ->
                            if (state.query.isEmpty()) item(key = "draft") {
                                DraftCard(draft, onResume = { onResumeDraft(draft.document.id) }, onDiscard = { discardDraft = true })
                            }
                        }
                        if (state.documents.isEmpty()) {
                            item(key = "no-results") {
                                EmptyState(
                                    icon = Icons.Outlined.SearchOff,
                                    title = stringResource(R.string.search_no_results_title),
                                    message = stringResource(R.string.search_no_results_message, state.query),
                                    scrollable = false,
                                )
                            }
                        }
                        items(state.documents, key = { it.document.id }) { summary ->
                            DocumentCard(
                                summary = summary,
                                onOpen = { onOpenDocument(summary.document.id) },
                                onRename = { renameTarget = summary.document.id },
                                onShare = { viewModel.share(summary) },
                                onDelete = { deleteTarget = summary.document.id },
                            )
                        }
                    }
                }
            }
        }
    }

    renameTarget?.let { id ->
        val current = state.documents.firstOrNull { it.document.id == id }
        if (current == null) renameTarget = null else RenameDialog(
            initial = current.document.name,
            onConfirm = { viewModel.rename(id, it); renameTarget = null },
            onDismiss = { renameTarget = null },
        )
    }
    deleteTarget?.let { id ->
        val current = state.documents.firstOrNull { it.document.id == id }
        if (current == null) deleteTarget = null else ConfirmDialog(
            title = stringResource(R.string.delete_title),
            message = stringResource(R.string.delete_message, current.document.name),
            confirmLabel = stringResource(R.string.action_delete),
            onConfirm = { viewModel.delete(id); deleteTarget = null },
            onDismiss = { deleteTarget = null },
        )
    }
    if (discardDraft) {
        state.draft?.let { draft ->
            ConfirmDialog(
                title = stringResource(R.string.discard_draft_title),
                message = stringResource(R.string.discard_draft_message),
                confirmLabel = stringResource(R.string.action_discard),
                onConfirm = { viewModel.discardDraft(draft.document.id); discardDraft = false },
                onDismiss = { discardDraft = false },
            )
        } ?: run { discardDraft = false }
    }
}

private const val MAX_IMPORT = 50

@Composable
private fun DraftCard(draft: DocumentSummary, onResume: () -> Unit, onDiscard: () -> Unit) {
    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.tertiaryContainer),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp)) {
            Text(stringResource(R.string.draft_title), style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onTertiaryContainer)
            Text(
                pluralStringResource(R.plurals.pages_count, draft.pageCount, draft.pageCount),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onTertiaryContainer,
            )
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                TextButton(onClick = onDiscard) { Text(stringResource(R.string.action_discard)) }
                TextButton(onClick = onResume) { Text(stringResource(R.string.action_resume)) }
            }
        }
    }
}

@Composable
private fun DocumentCard(
    summary: DocumentSummary,
    onOpen: () -> Unit,
    onRename: () -> Unit,
    onShare: () -> Unit,
    onDelete: () -> Unit,
) {
    val doc = summary.document
    val date = remember(doc.updatedAt) { DateFormat.getDateTimeInstance(DateFormat.MEDIUM, DateFormat.SHORT).format(Date(doc.updatedAt)) }
    val pagesText = pluralStringResource(R.plurals.pages_count, summary.pageCount, summary.pageCount)
    var menu by rememberSaveable { mutableStateOf(false) }
    val rowDescription = stringResource(R.string.document_row_description, doc.name, pagesText, date)

    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClickLabel = stringResource(R.string.action_open), onClick = onOpen).semantics(mergeDescendants = true) {
            contentDescription = rowDescription
        },
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
    ) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            PageThumbnail(
                page = summary.cover,
                cache = LocalThumbnails.current,
                contentDescription = null,
                modifier = Modifier.size(width = 64.dp, height = 84.dp).androidxClip(),
            )
            Spacer(Modifier.width(16.dp))
            Column(Modifier.weight(1f).clearAndSetSemantics { }) {
                Text(doc.name, style = MaterialTheme.typography.titleMedium, maxLines = 2, overflow = TextOverflow.Ellipsis)
                Spacer(Modifier.height(4.dp))
                Text("$pagesText · $date", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Box {
                IconButton(onClick = { menu = true }) {
                    Icon(Icons.Filled.MoreVert, contentDescription = stringResource(R.string.action_more_for, doc.name))
                }
                DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                    DropdownMenuItem(
                        text = { Text(stringResource(R.string.action_rename)) },
                        leadingIcon = { Icon(Icons.Outlined.Edit, null) },
                        onClick = { menu = false; onRename() },
                    )
                    DropdownMenuItem(
                        text = { Text(stringResource(R.string.action_share)) },
                        leadingIcon = { Icon(Icons.Outlined.Share, null) },
                        onClick = { menu = false; onShare() },
                    )
                    DropdownMenuItem(
                        text = { Text(stringResource(R.string.action_delete)) },
                        leadingIcon = { Icon(Icons.Outlined.Delete, null) },
                        onClick = { menu = false; onDelete() },
                    )
                }
            }
        }
    }
}

private fun Modifier.androidxClip(): Modifier = this.then(Modifier.clip(RoundedCornerShape(8.dp)))
