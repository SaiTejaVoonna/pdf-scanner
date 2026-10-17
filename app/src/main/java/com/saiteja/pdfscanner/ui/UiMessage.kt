package com.saiteja.pdfscanner.ui

import android.content.Context
import androidx.annotation.StringRes

/** A user-facing message resolved against string resources at display time (keeps ViewModels Context-free). */
class UiMessage(@StringRes val res: Int, vararg val args: Any) {
    fun resolve(context: Context): String = context.getString(res, *args)
}
