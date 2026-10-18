package com.saiteja.pdfscanner.domain

import java.util.Locale
import kotlin.math.roundToInt

/** Target size for the resize tool: the longest side in pixels, or null to keep the original size. */
enum class ResizePreset(val maxSide: Int?) {
    ORIGINAL(null),
    LARGE(2048),
    MEDIUM(1280),
    SMALL(800),
}

enum class ImageFormat(val mime: String, val extension: String) {
    JPEG("image/jpeg", "jpg"),
    PNG("image/png", "png"),
}

object ImageSizing {

    /** Scales [w]x[h] down so the longest side is at most [maxSide]; never enlarges. */
    fun fitWithin(w: Int, h: Int, maxSide: Int?): Pair<Int, Int> {
        if (maxSide == null || maxOf(w, h) <= maxSide) return w to h
        val scale = maxSide.toFloat() / maxOf(w, h)
        return (w * scale).roundToInt().coerceAtLeast(1) to (h * scale).roundToInt().coerceAtLeast(1)
    }

    /**
     * Output file name "<original base>-resized.<ext>", made unique within [taken] ("... (2)") so a batch
     * of photos with the same name never overwrites itself. Adds the chosen name to [taken].
     */
    fun outputName(original: String?, format: ImageFormat, taken: MutableSet<String>): String {
        val base = FileNames.sanitize(original?.substringBeforeLast('.', original).orEmpty(), fallback = "image")
        var candidate = "$base-resized.${format.extension}"
        var n = 2
        while (!taken.add(candidate.lowercase(Locale.ROOT))) {
            candidate = "$base-resized ($n).${format.extension}"
            n++
        }
        return candidate
    }

    fun formatBytes(bytes: Long): String = when {
        bytes < 1024 -> "$bytes B"
        bytes < 1024 * 1024 -> String.format(Locale.US, "%.0f KB", bytes / 1024.0)
        else -> String.format(Locale.US, "%.1f MB", bytes / (1024.0 * 1024.0))
    }
}
