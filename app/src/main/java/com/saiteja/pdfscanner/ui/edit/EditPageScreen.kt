package com.saiteja.pdfscanner.ui.edit

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.outlined.AutoFixHigh
import androidx.compose.material.icons.outlined.CropFree
import androidx.compose.material.icons.automirrored.outlined.RotateLeft
import androidx.compose.material.icons.automirrored.outlined.RotateRight
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.saiteja.pdfscanner.R
import com.saiteja.pdfscanner.domain.PageFilter
import com.saiteja.pdfscanner.domain.Pt
import com.saiteja.pdfscanner.domain.Quad
import com.saiteja.pdfscanner.ui.AppViewModelProvider
import com.saiteja.pdfscanner.ui.components.ConfirmDialog
import com.saiteja.pdfscanner.ui.components.EmptyState
import com.saiteja.pdfscanner.ui.components.label
import kotlin.math.roundToInt

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EditPageScreen(
    onClose: () -> Unit,
    viewModel: EditPageViewModel = viewModel(factory = AppViewModelProvider.Factory),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val snackbar = remember { SnackbarHostState() }
    var confirmDiscard by rememberSaveable { mutableStateOf(false) }

    LaunchedEffect(viewModel) {
        viewModel.eventFlow.collect { event ->
            when (event) {
                is EditEvent.Message -> snackbar.showSnackbar(event.message.resolve(context))
                EditEvent.Saved -> onClose()
            }
        }
    }
    val back = { if (state.dirty) confirmDiscard = true else onClose() }
    BackHandler(onBack = back)

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.edit_title)) },
                navigationIcon = {
                    IconButton(onClick = back) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.action_back)) }
                },
                actions = {
                    TextButton(onClick = viewModel::save, enabled = !state.loading && !state.failed) {
                        Icon(Icons.Filled.Check, null, Modifier.size(18.dp))
                        Spacer(Modifier.width(6.dp))
                        Text(stringResource(R.string.action_save))
                    }
                },
            )
        },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        Column(Modifier.padding(padding).fillMaxSize()) {
            when {
                state.loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
                state.failed -> EmptyState(
                    icon = Icons.Outlined.CropFree,
                    title = stringResource(R.string.edit_failed_title),
                    message = stringResource(R.string.edit_failed_message),
                    modifier = Modifier.fillMaxSize(),
                ) { OutlinedButton(onClick = onClose) { Text(stringResource(R.string.action_back)) } }
                else -> {
                    SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp)) {
                        SegmentedButton(
                            selected = state.step == EditStep.CROP,
                            onClick = { viewModel.setStep(EditStep.CROP) },
                            shape = SegmentedButtonDefaults.itemShape(0, 2),
                        ) { Text(stringResource(R.string.step_crop)) }
                        SegmentedButton(
                            selected = state.step == EditStep.ENHANCE,
                            onClick = { viewModel.setStep(EditStep.ENHANCE) },
                            shape = SegmentedButtonDefaults.itemShape(1, 2),
                        ) { Text(stringResource(R.string.step_enhance)) }
                    }
                    Box(Modifier.weight(1f).fillMaxWidth().background(MaterialTheme.colorScheme.surfaceContainerLowest)) {
                        if (state.step == EditStep.CROP) {
                            state.source?.let { source ->
                                CropEditor(
                                    image = source.asImageBitmap(),
                                    aspect = source.width.toFloat() / source.height,
                                    corners = state.corners,
                                    onMove = viewModel::moveCorner,
                                )
                            }
                        } else {
                            val preview = state.preview
                            if (preview != null) {
                                Image(
                                    bitmap = preview.asImageBitmap(),
                                    contentDescription = stringResource(R.string.edit_preview_description),
                                    contentScale = ContentScale.Fit,
                                    modifier = Modifier.fillMaxSize().padding(16.dp),
                                )
                            }
                            if (state.rendering || preview == null) {
                                CircularProgressIndicator(Modifier.align(Alignment.Center))
                            }
                        }
                    }
                    if (state.step == EditStep.CROP) {
                        CropControls(
                            detecting = state.detecting,
                            onAuto = viewModel::autoDetect,
                            onReset = viewModel::resetCorners,
                        )
                    } else {
                        EnhanceControls(
                            filter = state.filter,
                            onFilter = viewModel::setFilter,
                            onRotate = viewModel::rotate,
                        )
                    }
                }
            }
        }
    }

    if (confirmDiscard) {
        ConfirmDialog(
            title = stringResource(R.string.discard_changes_title),
            message = stringResource(R.string.discard_changes_message),
            confirmLabel = stringResource(R.string.action_discard),
            onConfirm = { confirmDiscard = false; onClose() },
            onDismiss = { confirmDiscard = false },
        )
    }
}

@Composable
private fun CropControls(detecting: Boolean, onAuto: () -> Unit, onReset: () -> Unit) {
    Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(stringResource(R.string.crop_hint), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            OutlinedButton(onClick = onAuto, enabled = !detecting, modifier = Modifier.weight(1f)) {
                if (detecting) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp) else Icon(Icons.Outlined.AutoFixHigh, null, Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text(stringResource(R.string.action_auto_detect))
            }
            OutlinedButton(onClick = onReset, modifier = Modifier.weight(1f)) {
                Icon(Icons.Outlined.CropFree, null, Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text(stringResource(R.string.action_full_page))
            }
        }
    }
}

@Composable
private fun EnhanceControls(filter: PageFilter, onFilter: (PageFilter) -> Unit, onRotate: (clockwise: Boolean) -> Unit) {
    Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(
            Modifier.horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PageFilter.entries.forEach { f ->
                FilterChip(
                    selected = filter == f,
                    onClick = { onFilter(f) },
                    label = { Text(f.label()) },
                )
            }
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = { onRotate(false) }) { Icon(Icons.AutoMirrored.Outlined.RotateLeft, contentDescription = stringResource(R.string.action_rotate_left)) }
            IconButton(onClick = { onRotate(true) }) { Icon(Icons.AutoMirrored.Outlined.RotateRight, contentDescription = stringResource(R.string.action_rotate_right)) }
        }
    }
}

private val HandleSize = 44.dp
private const val NUDGE = 0.01f

/**
 * The source image with a draggable quadrilateral. Each corner is its own focusable node with
 * "move" accessibility actions, so the crop is adjustable without touch-dragging too.
 */
@Composable
private fun CropEditor(image: androidx.compose.ui.graphics.ImageBitmap, aspect: Float, corners: Quad, onMove: (Int, Pt) -> Unit) {
    val density = LocalDensity.current
    val lineColor = MaterialTheme.colorScheme.primary
    val handleFill = MaterialTheme.colorScheme.primary
    val scrim = Color.Black.copy(alpha = 0.45f)

    BoxWithConstraints(Modifier.fillMaxSize().padding(HandleSize / 2)) {
        val maxW = constraints.maxWidth.toFloat()
        val maxH = constraints.maxHeight.toFloat()
        val fitW = if (maxW / maxH > aspect) maxH * aspect else maxW
        val fitH = if (maxW / maxH > aspect) maxH else maxW / aspect
        val left = (maxW - fitW) / 2f
        val top = (maxH - fitH) / 2f

        Image(
            bitmap = image,
            contentDescription = null,
            contentScale = ContentScale.Fit,
            modifier = Modifier.fillMaxSize(),
        )
        Canvas(Modifier.fillMaxSize()) {
            fun px(p: Pt) = Offset(left + p.x * fitW, top + p.y * fitH)
            val path = Path().apply {
                val pts = corners.points.map(::px)
                moveTo(pts[0].x, pts[0].y)
                for (i in 1 until 4) lineTo(pts[i].x, pts[i].y)
                close()
            }
            // Dim everything outside the selection.
            val outside = Path().apply {
                addRect(androidx.compose.ui.geometry.Rect(left, top, left + fitW, top + fitH))
                addPath(path)
                fillType = androidx.compose.ui.graphics.PathFillType.EvenOdd
            }
            drawPath(outside, scrim)
            drawPath(path, lineColor, style = Stroke(width = 3.dp.toPx()))
        }

        val names = listOf(R.string.corner_top_left, R.string.corner_top_right, R.string.corner_bottom_right, R.string.corner_bottom_left)
        corners.points.forEachIndexed { index, point ->
            val currentPoint by rememberUpdatedState(point)
            val currentFitW by rememberUpdatedState(fitW)
            val currentFitH by rememberUpdatedState(fitH)
            val name = stringResource(names[index])
            val moveLeft = stringResource(R.string.move_left)
            val moveRight = stringResource(R.string.move_right)
            val moveUp = stringResource(R.string.move_up)
            val moveDown = stringResource(R.string.move_down)
            val handlePx = with(density) { HandleSize.toPx() }
            Box(
                Modifier
                    .offset { IntOffset((left + point.x * fitW - handlePx / 2).roundToInt(), (top + point.y * fitH - handlePx / 2).roundToInt()) }
                    .size(HandleSize)
                    .semantics {
                        contentDescription = name
                        customActions = listOf(
                            CustomAccessibilityAction(moveLeft) { onMove(index, Pt(currentPoint.x - NUDGE, currentPoint.y)); true },
                            CustomAccessibilityAction(moveRight) { onMove(index, Pt(currentPoint.x + NUDGE, currentPoint.y)); true },
                            CustomAccessibilityAction(moveUp) { onMove(index, Pt(currentPoint.x, currentPoint.y - NUDGE)); true },
                            CustomAccessibilityAction(moveDown) { onMove(index, Pt(currentPoint.x, currentPoint.y + NUDGE)); true },
                        )
                    }
                    .pointerInput(index) {
                        detectDragGestures { change, drag ->
                            change.consume()
                            onMove(
                                index,
                                Pt(currentPoint.x + drag.x / currentFitW, currentPoint.y + drag.y / currentFitH),
                            )
                        }
                    },
                contentAlignment = Alignment.Center,
            ) {
                Box(Modifier.size(24.dp).background(handleFill.copy(alpha = 0.85f), CircleShape))
                Box(Modifier.size(10.dp).background(Color.White, CircleShape))
            }
        }
    }
}
