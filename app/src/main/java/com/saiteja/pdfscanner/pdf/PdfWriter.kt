package com.saiteja.pdfscanner.pdf

import com.saiteja.pdfscanner.domain.PdfPageSize
import java.io.OutputStream
import java.time.ZoneOffset
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

/** A page image as a ready-to-embed baseline JPEG. */
class PdfImage(val jpeg: ByteArray, val widthPx: Int, val heightPx: Int)

/**
 * Minimal, dependency-free PDF 1.4 writer. Each page embeds one JPEG verbatim (DCTDecode), which
 * keeps files small and avoids re-encoding. Images are requested one at a time through
 * [imageAt] so large documents never hold every page in memory.
 */
object PdfWriter {

    /** Resolution used to turn pixels into points for [PdfPageSize.MATCH_IMAGE]. */
    private const val MATCH_IMAGE_DPI = 150f

    class PageGeometry(val pageW: Float, val pageH: Float, val x: Float, val y: Float, val w: Float, val h: Float)

    /** Page box and image placement: scaled to fit, centred, orientation follows the image. */
    fun layout(size: PdfPageSize, imageW: Int, imageH: Int): PageGeometry {
        if (size == PdfPageSize.MATCH_IMAGE) {
            val w = imageW * 72f / MATCH_IMAGE_DPI
            val h = imageH * 72f / MATCH_IMAGE_DPI
            return PageGeometry(w, h, 0f, 0f, w, h)
        }
        val landscape = imageW > imageH
        val pageW = if (landscape) size.heightPt else size.widthPt
        val pageH = if (landscape) size.widthPt else size.heightPt
        val scale = minOf(pageW / imageW, pageH / imageH)
        val w = imageW * scale
        val h = imageH * scale
        return PageGeometry(pageW, pageH, (pageW - w) / 2f, (pageH - h) / 2f, w, h)
    }

    fun write(
        out: OutputStream,
        pageCount: Int,
        size: PdfPageSize,
        title: String,
        created: ZonedDateTime = ZonedDateTime.now(ZoneOffset.UTC),
        onProgress: (done: Int, total: Int) -> Unit = { _, _ -> },
        imageAt: (index: Int) -> PdfImage,
    ) {
        require(pageCount > 0) { "A PDF needs at least one page" }
        val counting = CountingStream(out)
        val offsets = LongArray(3 + pageCount * 3 + 1) // index = object number
        fun pageObj(i: Int) = 4 + i * 3
        fun contentObj(i: Int) = 5 + i * 3
        fun imageObj(i: Int) = 6 + i * 3
        val lastObj = 3 + pageCount * 3

        counting.writeAscii("%PDF-1.4\n")
        counting.write(byteArrayOf('%'.code.toByte(), 0xE2.toByte(), 0xE3.toByte(), 0xCF.toByte(), 0xD3.toByte(), '\n'.code.toByte()))

        fun beginObj(n: Int) { offsets[n] = counting.count; counting.writeAscii("$n 0 obj\n") }

        beginObj(1)
        counting.writeAscii("<< /Type /Catalog /Pages 2 0 R >>\nendobj\n")

        beginObj(2)
        val kids = (0 until pageCount).joinToString(" ") { "${pageObj(it)} 0 R" }
        counting.writeAscii("<< /Type /Pages /Count $pageCount /Kids [$kids] >>\nendobj\n")

        beginObj(3)
        val date = created.format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss", Locale.ROOT))
        counting.writeAscii("<< /Title ${pdfTextString(title)} /Producer (PDF Scanner) /CreationDate (D:${date}Z) >>\nendobj\n")

        for (i in 0 until pageCount) {
            val image = imageAt(i)
            val g = layout(size, image.widthPx, image.heightPx)

            beginObj(pageObj(i))
            counting.writeAscii(
                "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(g.pageW)} ${num(g.pageH)}] " +
                    "/Resources << /XObject << /Im0 ${imageObj(i)} 0 R >> >> /Contents ${contentObj(i)} 0 R >>\nendobj\n",
            )

            val content = "q ${num(g.w)} 0 0 ${num(g.h)} ${num(g.x)} ${num(g.y)} cm /Im0 Do Q\n".toByteArray(Charsets.US_ASCII)
            beginObj(contentObj(i))
            counting.writeAscii("<< /Length ${content.size} >>\nstream\n")
            counting.write(content)
            counting.writeAscii("endstream\nendobj\n")

            beginObj(imageObj(i))
            counting.writeAscii(
                "<< /Type /XObject /Subtype /Image /Width ${image.widthPx} /Height ${image.heightPx} " +
                    "/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.jpeg.size} >>\nstream\n",
            )
            counting.write(image.jpeg)
            counting.writeAscii("\nendstream\nendobj\n")
            onProgress(i + 1, pageCount)
        }

        val xrefOffset = counting.count
        counting.writeAscii("xref\n0 ${lastObj + 1}\n")
        counting.writeAscii("0000000000 65535 f \n")
        for (n in 1..lastObj) counting.writeAscii(String.format(Locale.ROOT, "%010d 00000 n \n", offsets[n]))
        counting.writeAscii("trailer\n<< /Size ${lastObj + 1} /Root 1 0 R /Info 3 0 R >>\nstartxref\n$xrefOffset\n%%EOF\n")
        counting.flush()
    }

    private fun num(v: Float): String = String.format(Locale.ROOT, "%.2f", v)

    /** UTF-16BE hex string, valid for any title including non-ASCII characters. */
    private fun pdfTextString(text: String): String {
        val sb = StringBuilder("<FEFF")
        for (b in text.toByteArray(Charsets.UTF_16BE)) sb.append(String.format(Locale.ROOT, "%02X", b))
        return sb.append('>').toString()
    }

    private class CountingStream(private val out: OutputStream) : OutputStream() {
        var count = 0L
            private set

        override fun write(b: Int) { out.write(b); count++ }
        override fun write(b: ByteArray, off: Int, len: Int) { out.write(b, off, len); count += len }
        override fun flush() = out.flush()
        fun writeAscii(s: String) = write(s.toByteArray(Charsets.ISO_8859_1))
    }
}
