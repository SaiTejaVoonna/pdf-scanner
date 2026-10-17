package com.saiteja.pdfscanner.ui

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.widget.Toast
import androidx.core.content.FileProvider
import com.saiteja.pdfscanner.R
import java.io.File

object ShareSupport {

    fun authority(context: Context) = "${context.packageName}.fileprovider"

    /**
     * Shares a PDF through a FileProvider content:// URI with a temporary read grant, so the
     * receiving app gets only this one file and never a path into our private storage.
     */
    fun sharePdf(context: Context, file: File, title: String) {
        val uri = FileProvider.getUriForFile(context, authority(context), file)
        val send = Intent(Intent.ACTION_SEND).apply {
            type = "application/pdf"
            putExtra(Intent.EXTRA_STREAM, uri)
            putExtra(Intent.EXTRA_SUBJECT, title)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            clipData = android.content.ClipData.newRawUri(title, uri)
        }
        try {
            context.startActivity(Intent.createChooser(send, context.getString(R.string.share_chooser_title)).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION))
        } catch (e: ActivityNotFoundException) {
            Toast.makeText(context, R.string.msg_no_share_target, Toast.LENGTH_LONG).show()
        }
    }
}
