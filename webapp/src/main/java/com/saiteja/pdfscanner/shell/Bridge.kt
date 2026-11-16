package com.saiteja.pdfscanner.shell

import android.util.Base64
import android.webkit.JavascriptInterface
import java.io.File
import java.io.OutputStream
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger

/**
 * What the page (assets/shell.js) can ask Android to do: receive a file in pieces, then share it or save it.
 * Files land in cache/exports/<n>/<name>; that folder is emptied each time the app starts.
 */
class Bridge(private val exports: File, private val onShare: (List<File>, String) -> Unit, private val onSave: (File, String) -> Unit) {
    private class Incoming(val file: File, val out: OutputStream)

    private val next = AtomicInteger()
    private val open = ConcurrentHashMap<String, Incoming>()
    private val done = ConcurrentHashMap<String, File>()

    @JavascriptInterface
    fun open(name: String): String {
        val token = next.incrementAndGet().toString()
        val dir = File(exports, token).apply { mkdirs() }
        val file = File(dir, safeName(name))
        open[token] = Incoming(file, file.outputStream().buffered())
        return token
    }

    @JavascriptInterface
    fun append(token: String, base64: String) {
        open[token]?.out?.write(Base64.decode(base64, Base64.DEFAULT))
    }

    @JavascriptInterface
    fun close(token: String) {
        val f = open.remove(token) ?: return
        f.out.close()
        done[token] = f.file
    }

    @JavascriptInterface
    fun share(tokens: String, mime: String) {
        val files = tokens.split(',').mapNotNull { done.remove(it) }
        if (files.isNotEmpty()) onShare(files, mime)
    }

    @JavascriptInterface
    fun save(token: String, mime: String) {
        done.remove(token)?.let { onSave(it, mime) }
    }

    companion object {
        /** A file name with no folders in it and nothing a file system refuses. */
        fun safeName(name: String): String {
            val s = name.substringAfterLast('/').substringAfterLast('\\').replace(Regex("[\\u0000-\\u001f\"*:<>?|]"), "_").trim().trimStart('.')
            return s.take(120).ifEmpty { "file" }
        }
    }
}
