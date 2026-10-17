package com.saiteja.pdfscanner.ui.camera

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.Camera
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.outlined.CameraAlt
import androidx.compose.material.icons.outlined.FlashOff
import androidx.compose.material.icons.outlined.FlashOn
import androidx.compose.material.icons.outlined.PhotoLibrary
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.saiteja.pdfscanner.R
import com.saiteja.pdfscanner.ui.AppViewModelProvider
import com.saiteja.pdfscanner.ui.components.LocalThumbnails
import com.saiteja.pdfscanner.ui.components.PageThumbnail
import java.util.concurrent.Executor
import kotlin.coroutines.resume
import kotlinx.coroutines.suspendCancellableCoroutine

private const val MAX_IMPORT = 50

/**
 * Capture screen. [onFinished] receives the document id (null if nothing was captured) when the
 * user taps Done; the back arrow leaves any captured pages behind as a resumable draft.
 */
@Composable
fun CameraScreen(
    onFinished: (documentId: String?) -> Unit,
    onBack: () -> Unit,
    viewModel: CameraViewModel = viewModel(factory = AppViewModelProvider.Factory),
) {
    val context = LocalContext.current
    val pages by viewModel.pages.collectAsStateWithLifecycle()
    val busy by viewModel.busy.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }

    var permissionGranted by remember {
        mutableStateOf(ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED)
    }
    var permissionAsked by rememberSaveable { mutableStateOf(false) }
    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        permissionGranted = granted
        permissionAsked = true
    }
    // The user may have granted access from system settings while we were in the background.
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) {
        permissionGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
    }
    // Ask once automatically; after a denial the rationale screen explains the alternatives.
    LaunchedEffect(Unit) {
        if (!permissionGranted && !permissionAsked) permissionLauncher.launch(Manifest.permission.CAMERA)
    }

    val picker = rememberLauncherForActivityResult(ActivityResultContracts.PickMultipleVisualMedia(MAX_IMPORT)) { uris ->
        viewModel.onImported(uris)
    }
    val launchPicker = { picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) }

    LaunchedEffect(viewModel) {
        viewModel.messages.collect { snackbar.showSnackbar(it.resolve(context)) }
    }

    Box(Modifier.fillMaxSize().background(Color.Black)) {
        if (permissionGranted) {
            CameraContent(
                pageCount = pages.size,
                lastPage = pages.lastOrNull(),
                busy = busy,
                newCaptureFile = viewModel::newCaptureFile,
                onCaptured = viewModel::onCaptured,
                onCaptureFailed = viewModel::onCaptureFailed,
                onImport = launchPicker,
                onDone = { onFinished(viewModel.currentDocumentId) },
                onBack = onBack,
            )
        } else {
            PermissionDenied(
                askedBefore = permissionAsked,
                permanentlyDenied = permissionAsked && !shouldShowRationale(context),
                onRequest = { permissionLauncher.launch(Manifest.permission.CAMERA) },
                onImport = launchPicker,
                onBack = onBack,
            )
        }
        if (busy) {
            Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.4f)), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        }
        SnackbarHost(snackbar, Modifier.align(Alignment.BottomCenter).navigationBarsPadding().padding(bottom = 140.dp))
    }
}

private fun shouldShowRationale(context: Context): Boolean {
    val activity = context as? Activity ?: return true
    return androidx.core.app.ActivityCompat.shouldShowRequestPermissionRationale(activity, Manifest.permission.CAMERA)
}

@Composable
private fun CameraContent(
    pageCount: Int,
    lastPage: com.saiteja.pdfscanner.domain.ScanPage?,
    busy: Boolean,
    newCaptureFile: () -> java.io.File,
    onCaptured: (java.io.File) -> Unit,
    onCaptureFailed: () -> Unit,
    onImport: () -> Unit,
    onDone: () -> Unit,
    onBack: () -> Unit,
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val executor: Executor = remember { ContextCompat.getMainExecutor(context) }
    val previewView = remember { PreviewView(context).apply { scaleType = PreviewView.ScaleType.FIT_CENTER } }
    val imageCapture = remember { ImageCapture.Builder().setCaptureMode(ImageCapture.CAPTURE_MODE_MAXIMIZE_QUALITY).build() }
    var camera by remember { mutableStateOf<Camera?>(null) }
    var torch by rememberSaveable { mutableStateOf(false) }
    var cameraUnavailable by rememberSaveable { mutableStateOf(false) }
    var capturing by remember { mutableStateOf(false) }

    LaunchedEffect(lifecycleOwner) {
        try {
            val provider = context.cameraProvider()
            val preview = Preview.Builder().build().also { it.surfaceProvider = previewView.surfaceProvider }
            provider.unbindAll()
            camera = provider.bindToLifecycle(lifecycleOwner, CameraSelector.DEFAULT_BACK_CAMERA, preview, imageCapture)
        } catch (e: Exception) {
            cameraUnavailable = true
        }
    }
    DisposableEffect(lifecycleOwner) {
        onDispose { runCatching { ProcessCameraProvider.getInstance(context).get().unbindAll() } }
    }
    LaunchedEffect(camera, torch) {
        val c = camera ?: return@LaunchedEffect
        if (c.cameraInfo.hasFlashUnit()) c.cameraControl.enableTorch(torch)
    }

    if (cameraUnavailable) {
        PermissionDenied(
            askedBefore = true,
            permanentlyDenied = false,
            unavailable = true,
            onRequest = {},
            onImport = onImport,
            onBack = onBack,
        )
        return
    }

    Box(Modifier.fillMaxSize()) {
        AndroidView(factory = { previewView }, modifier = Modifier.fillMaxSize())

        Row(
            Modifier.fillMaxWidth().statusBarsPadding().padding(8.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            ScrimIconButton(onClick = onBack, icon = Icons.AutoMirrored.Filled.ArrowBack, description = stringResource(R.string.action_back))
            if (camera?.cameraInfo?.hasFlashUnit() == true) {
                ScrimIconButton(
                    onClick = { torch = !torch },
                    icon = if (torch) Icons.Outlined.FlashOn else Icons.Outlined.FlashOff,
                    description = stringResource(if (torch) R.string.action_flash_off else R.string.action_flash_on),
                )
            }
        }

        Column(
            Modifier.align(Alignment.BottomCenter).fillMaxWidth().navigationBarsPadding().padding(bottom = 20.dp, start = 24.dp, end = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                stringResource(R.string.camera_hint),
                color = Color.White,
                style = MaterialTheme.typography.bodySmall,
                textAlign = TextAlign.Center,
                modifier = Modifier.background(Color.Black.copy(alpha = 0.45f), RoundedCornerShape(12.dp)).padding(horizontal = 12.dp, vertical = 6.dp),
            )
            Spacer(Modifier.height(16.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                ScrimIconButton(onClick = onImport, icon = Icons.Outlined.PhotoLibrary, description = stringResource(R.string.action_import_photos), size = 56.dp)

                ShutterButton(
                    enabled = !capturing && !busy && camera != null,
                    onClick = {
                        capturing = true
                        val file = newCaptureFile()
                        imageCapture.takePicture(
                            ImageCapture.OutputFileOptions.Builder(file).build(),
                            executor,
                            object : ImageCapture.OnImageSavedCallback {
                                override fun onImageSaved(output: ImageCapture.OutputFileResults) {
                                    capturing = false
                                    onCaptured(file)
                                }

                                override fun onError(exception: ImageCaptureException) {
                                    capturing = false
                                    file.delete()
                                    onCaptureFailed()
                                }
                            },
                        )
                    },
                )

                DoneButton(pageCount = pageCount, lastPage = lastPage, onClick = onDone)
            }
        }
    }
}

@Composable
private fun ScrimIconButton(onClick: () -> Unit, icon: androidx.compose.ui.graphics.vector.ImageVector, description: String, size: androidx.compose.ui.unit.Dp = 48.dp) {
    IconButton(
        onClick = onClick,
        modifier = Modifier.size(size),
        colors = IconButtonDefaults.iconButtonColors(containerColor = Color.Black.copy(alpha = 0.45f), contentColor = Color.White),
    ) {
        Icon(icon, contentDescription = description)
    }
}

@Composable
private fun ShutterButton(enabled: Boolean, onClick: () -> Unit) {
    val description = stringResource(R.string.action_capture)
    Box(
        Modifier
            .size(76.dp)
            .border(4.dp, Color.White, CircleShape)
            .padding(7.dp)
            .clip(CircleShape)
            .background(if (enabled) Color.White else Color.White.copy(alpha = 0.4f))
            .clickable(enabled = enabled, onClickLabel = description, onClick = onClick)
            .semantics { contentDescription = description },
    )
}

@Composable
private fun DoneButton(pageCount: Int, lastPage: com.saiteja.pdfscanner.domain.ScanPage?, onClick: () -> Unit) {
    if (pageCount == 0) {
        Spacer(Modifier.size(56.dp))
        return
    }
    val description = pluralStringResource(R.plurals.camera_done_description, pageCount, pageCount)
    Box(
        Modifier.size(56.dp).clip(RoundedCornerShape(12.dp)).border(2.dp, Color.White, RoundedCornerShape(12.dp))
            .clickable(onClickLabel = stringResource(R.string.action_done), onClick = onClick)
            .semantics { contentDescription = description },
    ) {
        PageThumbnail(page = lastPage, cache = LocalThumbnails.current, contentDescription = null, modifier = Modifier.fillMaxSize(), contentScale = androidx.compose.ui.layout.ContentScale.Crop)
        Box(
            Modifier.align(Alignment.BottomEnd).padding(2.dp).size(22.dp).background(MaterialTheme.colorScheme.primary, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Text("$pageCount", color = MaterialTheme.colorScheme.onPrimary, style = MaterialTheme.typography.labelSmall)
        }
        Icon(Icons.Filled.Check, null, tint = Color.White, modifier = Modifier.align(Alignment.TopStart).padding(2.dp).size(16.dp).background(Color.Black.copy(alpha = 0.5f), CircleShape))
    }
}

@Composable
private fun PermissionDenied(
    askedBefore: Boolean,
    permanentlyDenied: Boolean,
    onRequest: () -> Unit,
    onImport: () -> Unit,
    onBack: () -> Unit,
    unavailable: Boolean = false,
) {
    val context = LocalContext.current
    Column(
        Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surface).statusBarsPadding().navigationBarsPadding().padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icon(Icons.Outlined.CameraAlt, null, Modifier.size(56.dp), tint = MaterialTheme.colorScheme.primary)
        Spacer(Modifier.height(16.dp))
        Text(
            stringResource(if (unavailable) R.string.camera_unavailable_title else R.string.camera_permission_title),
            style = MaterialTheme.typography.titleLarge,
            textAlign = TextAlign.Center,
            color = MaterialTheme.colorScheme.onSurface,
        )
        Spacer(Modifier.height(8.dp))
        Text(
            stringResource(
                when {
                    unavailable -> R.string.camera_unavailable_message
                    askedBefore -> R.string.camera_permission_denied_message
                    else -> R.string.camera_permission_message
                },
            ),
            style = MaterialTheme.typography.bodyMedium,
            textAlign = TextAlign.Center,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(24.dp))
        if (!unavailable) {
            if (permanentlyDenied) {
                Button(onClick = {
                    context.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", context.packageName, null)))
                }) { Text(stringResource(R.string.action_open_settings)) }
            } else {
                Button(onClick = onRequest) { Text(stringResource(R.string.action_grant_camera)) }
            }
            Spacer(Modifier.height(8.dp))
        }
        OutlinedButton(onClick = onImport) { Text(stringResource(R.string.action_import_photos)) }
        TextButton(onClick = onBack) { Text(stringResource(R.string.action_back)) }
    }
}

private suspend fun Context.cameraProvider(): ProcessCameraProvider = suspendCancellableCoroutine { cont ->
    val future = ProcessCameraProvider.getInstance(this)
    future.addListener({
        try {
            cont.resume(future.get())
        } catch (e: Exception) {
            cont.resumeWith(Result.failure(e))
        }
    }, ContextCompat.getMainExecutor(this))
}
