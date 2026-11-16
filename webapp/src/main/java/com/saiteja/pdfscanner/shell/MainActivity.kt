package com.saiteja.pdfscanner.shell

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.ContentValues
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.webkit.MimeTypeMap
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.updatePadding
import java.io.ByteArrayInputStream
import java.io.File
import java.io.IOException

/**
 * Shows the web app (packed in assets/www) in a WebView under https://appassets.androidplatform.net/, a secure address that
 * never leaves the phone: the app has no INTERNET permission. Camera, file picking, sharing, saving and the back button are
 * connected to Android here; everything else is the web app itself.
 */
class MainActivity : ComponentActivity() {
    private lateinit var web: WebView
    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private var cameraRequest: PermissionRequest? = null
    private var pendingSave: Pair<File, String>? = null

    private val pickFiles = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { r ->
        val data = r.data
        val uris = mutableListOf<Uri>()
        if (r.resultCode == Activity.RESULT_OK && data != null) {
            data.clipData?.let { c -> for (i in 0 until c.itemCount) uris += c.getItemAt(i).uri }
            if (uris.isEmpty()) data.data?.let { uris += it }
        }
        fileCallback?.onReceiveValue(uris.toTypedArray())
        fileCallback = null
    }

    private val askCamera = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        cameraRequest?.let { if (granted) it.grant(arrayOf(PermissionRequest.RESOURCE_VIDEO_CAPTURE)) else it.deny() }
        cameraRequest = null
    }

    /** Android 8 and 9 have no shared Downloads table: the person picks where the file goes. */
    private val createDocument = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { r ->
        val (file, _) = pendingSave ?: return@registerForActivityResult
        pendingSave = null
        val target = r.data?.data
        if (r.resultCode != Activity.RESULT_OK || target == null) return@registerForActivityResult
        try {
            contentResolver.openOutputStream(target)!!.use { out -> file.inputStream().use { it.copyTo(out) } }
            toast(getString(R.string.saved_to_downloads, file.name))
        } catch (e: IOException) {
            toast(getString(R.string.save_failed))
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val exports = File(cacheDir, "exports").apply { deleteRecursively(); mkdirs() }

        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowCompat.getInsetsController(window, window.decorView).apply {
            val light = resources.getBoolean(R.bool.light_bars)
            isAppearanceLightStatusBars = light
            isAppearanceLightNavigationBars = light
        }
        web = WebView(this)
        val frame = FrameLayout(this).apply {
            setBackgroundColor(ContextCompat.getColor(context, R.color.window_background))
            addView(web, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
        }
        // The page stays clear of the status bar, the navigation bar and the keyboard.
        ViewCompat.setOnApplyWindowInsetsListener(frame) { v, insets ->
            val b = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout() or WindowInsetsCompat.Type.ime())
            v.updatePadding(b.left, b.top, b.right, b.bottom)
            WindowInsetsCompat.CONSUMED
        }
        setContentView(frame)

        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false // the camera preview starts by itself
            allowFileAccess = false
            textZoom = 100
        }
        web.addJavascriptInterface(Bridge(exports, { f, m -> runOnUiThread { share(f, m) } }, { f, m -> runOnUiThread { save(f, m) } }), "AndroidShell")
        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                if (request.url.host == HOST) serve(request.url.path.orEmpty()) else null

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                if (request.url.host == HOST) return false
                try { startActivity(Intent(Intent.ACTION_VIEW, request.url)) } catch (e: Exception) { /* no app opens it */ }
                return true
            }
        }
        web.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                val camera = request.origin.host == HOST && request.resources.contentEquals(arrayOf(PermissionRequest.RESOURCE_VIDEO_CAPTURE))
                when {
                    !camera -> request.deny()
                    ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED ->
                        request.grant(request.resources)
                    else -> { cameraRequest?.deny(); cameraRequest = request; askCamera.launch(Manifest.permission.CAMERA) }
                }
            }

            override fun onShowFileChooser(view: WebView, callback: ValueCallback<Array<Uri>>, params: FileChooserParams): Boolean {
                fileCallback?.onReceiveValue(null)
                fileCallback = callback
                return try { pickFiles.launch(params.createIntent()); true } catch (e: Exception) { fileCallback = null; false }
            }
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                web.evaluateJavascript("!!(window.__shellBack && window.__shellBack())") { handled -> if (handled != "true") moveTaskToBack(true) }
            }
        })

        if (savedInstanceState == null) web.loadUrl("https://$HOST/index.html") else web.restoreState(savedInstanceState)
    }

    override fun onSaveInstanceState(outState: Bundle) { super.onSaveInstanceState(outState); web.saveState(outState) }

    override fun onDestroy() { web.destroy(); super.onDestroy() }

    /** A file of the web app from assets/www, or 404. index.html gets shell.js added in front of the app's own script. */
    private fun serve(path: String): WebResourceResponse {
        val rel = path.trimStart('/').ifEmpty { "index.html" }
        val headers = mapOf("Cache-Control" to "no-cache")
        return try {
            when {
                rel.contains("..") -> throw IOException("bad path")
                rel == "__shell.js" -> WebResourceResponse("text/javascript", "utf-8", 200, "OK", headers, assets.open("shell.js"))
                rel == "index.html" -> {
                    val html = assets.open("www/index.html").bufferedReader().use { it.readText() }
                    val at = html.indexOf("<script").let { if (it < 0) html.length else it }
                    val out = html.substring(0, at) + "<script src=\"/__shell.js\"></script>" + html.substring(at)
                    WebResourceResponse("text/html", "utf-8", 200, "OK", headers, ByteArrayInputStream(out.toByteArray()))
                }
                else -> WebResourceResponse(mime(rel), null, 200, "OK", headers, assets.open("www/$rel"))
            }
        } catch (e: IOException) {
            WebResourceResponse("text/plain", "utf-8", 404, "Not Found", headers, ByteArrayInputStream(ByteArray(0)))
        }
    }

    private fun share(files: List<File>, mime: String) {
        val uris = ArrayList(files.map { FileProvider.getUriForFile(this, "$packageName.fileprovider", it) })
        val send = if (uris.size == 1) Intent(Intent.ACTION_SEND).putExtra(Intent.EXTRA_STREAM, uris[0])
        else Intent(Intent.ACTION_SEND_MULTIPLE).putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris)
        send.setType(mime).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        startActivity(Intent.createChooser(send, getString(R.string.share_title)))
    }

    private fun save(file: File, mime: String) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            pendingSave = file to mime
            createDocument.launch(Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(mime).putExtra(Intent.EXTRA_TITLE, file.name))
            return
        }
        val values = ContentValues().apply {
            put(MediaStore.Downloads.DISPLAY_NAME, file.name)
            put(MediaStore.Downloads.MIME_TYPE, mime)
            put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
        }
        try {
            val target = contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values) ?: throw IOException("no row")
            contentResolver.openOutputStream(target)!!.use { out -> file.inputStream().use { it.copyTo(out) } }
            toast(getString(R.string.saved_to_downloads, file.name))
        } catch (e: IOException) {
            toast(getString(R.string.save_failed))
        }
    }

    private fun toast(text: String) = Toast.makeText(this, text, Toast.LENGTH_LONG).show()

    companion object {
        const val HOST = "appassets.androidplatform.net"

        fun mime(path: String): String = when (path.substringAfterLast('.', "").lowercase()) {
            "js", "mjs" -> "text/javascript"
            "css" -> "text/css"
            "html" -> "text/html"
            "json", "webmanifest" -> "application/json"
            "svg" -> "image/svg+xml"
            "wasm" -> "application/wasm"
            "bin" -> "application/octet-stream"
            else -> MimeTypeMap.getSingleton().getMimeTypeFromExtension(path.substringAfterLast('.', "").lowercase()) ?: "application/octet-stream"
        }
    }
}
