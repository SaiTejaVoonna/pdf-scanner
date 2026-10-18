package com.saiteja.pdfscanner.domain

enum class PageFilter { ORIGINAL, ENHANCED, GRAYSCALE, BLACK_WHITE }

/** PDF size/quality trade-off: longest image side in pixels and JPEG quality. */
enum class PdfQuality(val maxSide: Int, val jpegQuality: Int) {
    HIGH(2480, 90),      // about 300 dpi on A4
    BALANCED(1754, 80),  // about 150 dpi on A4
    SMALL(1240, 65),     // about 100 dpi on A4
}

/** PDF page size choices. [MATCH_IMAGE] sizes every page to its scan. */
enum class PdfPageSize(val widthPt: Float, val heightPt: Float) {
    A4(595.28f, 841.89f),
    LETTER(612f, 792f),
    MATCH_IMAGE(0f, 0f),
}

/** One scanned page: an upright source image plus non-destructive edit parameters. */
data class ScanPage(
    val id: String,
    val documentId: String,
    val position: Int,
    val sourceFile: String,
    val corners: Quad,
    val rotation: Int,
    val filter: PageFilter,
) {
    /** Changes whenever the rendered output would change; used as a thumbnail cache key. */
    val renderKey: String get() = "$id-${corners.toStorage().hashCode()}-$rotation-${filter.name}"
}

data class ScanDocument(
    val id: String,
    val name: String,
    val createdAt: Long,
    val updatedAt: Long,
    val isDraft: Boolean,
    val pageSize: PdfPageSize,
)

/** A document with the pieces needed to list it. */
data class DocumentSummary(
    val document: ScanDocument,
    val pages: List<ScanPage>,
) {
    val pageCount: Int get() = pages.size
    val cover: ScanPage? get() = pages.firstOrNull()
}
