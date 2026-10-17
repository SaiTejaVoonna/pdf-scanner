package com.saiteja.pdfscanner.domain

import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

object FileNames {
    private val illegal = Regex("""[\\/:*?"<>|\p{Cntrl}]""")
    private const val MAX_BASE_LENGTH = 100

    /** Makes [raw] safe as a file name base (no extension). Never returns an empty string. */
    fun sanitize(raw: String, fallback: String = "Scan"): String {
        val cleaned = raw
            .replace(illegal, " ")
            .replace(Regex("\\s+"), " ")
            .trim()
            .trim('.')
            .removeSuffix(".pdf")
            .removeSuffix(".PDF")
            .trim()
            .take(MAX_BASE_LENGTH)
            .trim()
        return cleaned.ifEmpty { fallback }
    }

    fun pdfFileName(raw: String): String = sanitize(raw) + ".pdf"

    fun defaultDocumentName(now: LocalDateTime = LocalDateTime.now()): String =
        "Scan " + now.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH.mm"))

    /** Case-insensitive "contains" match used by the library search box. */
    fun matches(name: String, query: String): Boolean {
        val q = query.trim()
        return q.isEmpty() || name.contains(q, ignoreCase = true)
    }
}
