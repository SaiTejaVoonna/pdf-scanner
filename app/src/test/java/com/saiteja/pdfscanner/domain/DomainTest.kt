package com.saiteja.pdfscanner.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDateTime

class PageOrderTest {
    private val ids = listOf("a", "b", "c", "d")

    @Test fun `move forward and backward`() {
        assertEquals(listOf("b", "c", "a", "d"), PageOrder.move(ids, 0, 2))
        assertEquals(listOf("a", "d", "b", "c"), PageOrder.move(ids, 3, 1))
    }

    @Test fun `move clamps out of range targets and ignores invalid sources`() {
        assertEquals(listOf("b", "c", "d", "a"), PageOrder.move(ids, 0, 99))
        assertEquals(listOf("d", "a", "b", "c"), PageOrder.move(ids, 3, -5))
        assertEquals(ids, PageOrder.move(ids, 7, 0))
        assertEquals(ids, PageOrder.move(ids, 2, 2))
    }

    @Test fun `moveBy shifts by delta and is a no-op at the ends`() {
        assertEquals(listOf("a", "c", "b", "d"), PageOrder.moveBy(ids, "b", 1))
        assertEquals(listOf("b", "a", "c", "d"), PageOrder.moveBy(ids, "b", -1))
        assertEquals(ids, PageOrder.moveBy(ids, "a", -1))
        assertEquals(ids, PageOrder.moveBy(ids, "d", 1))
        assertEquals(ids, PageOrder.moveBy(ids, "zzz", 1))
    }

    @Test fun `remove drops the id`() {
        assertEquals(listOf("a", "c", "d"), PageOrder.remove(ids, "b"))
        assertEquals(ids, PageOrder.remove(ids, "x"))
    }
}

class FileNamesTest {
    @Test fun `sanitize strips illegal characters and trims`() {
        assertEquals("a b c d e f g h i", FileNames.sanitize("a/b\\c:d*e?f\"g<h>i"))
        assertEquals("Tax 2025", FileNames.sanitize("  Tax   2025  "))
        assertEquals("notes", FileNames.sanitize("notes.pdf"))
        assertEquals("notes", FileNames.sanitize("notes.PDF"))
        assertEquals("hidden", FileNames.sanitize("...hidden..."))
    }

    @Test fun `sanitize never returns empty and caps length`() {
        assertEquals("Scan", FileNames.sanitize(""))
        assertEquals("Scan", FileNames.sanitize("///"))
        assertEquals("Fallback", FileNames.sanitize("   ", fallback = "Fallback"))
        assertEquals(100, FileNames.sanitize("x".repeat(300)).length)
    }

    @Test fun `sanitize keeps unicode and removes control characters`() {
        assertEquals("Café 発票", FileNames.sanitize("Café 発票"))
        assertEquals("a b", FileNames.sanitize("a\u0000\nb"))
    }

    @Test fun `pdf file name always ends with a single pdf extension`() {
        assertEquals("Invoice.pdf", FileNames.pdfFileName("Invoice"))
        assertEquals("Invoice.pdf", FileNames.pdfFileName("Invoice.pdf"))
    }

    @Test fun `default name is timestamped and filesystem safe`() {
        val name = FileNames.defaultDocumentName(LocalDateTime.of(2026, 3, 9, 14, 5))
        assertEquals("Scan 2026-03-09 14.05", name)
        assertEquals(name, FileNames.sanitize(name))
    }

    @Test fun `search matches case insensitively and treats blank as match all`() {
        assertTrue(FileNames.matches("Rental Agreement", "agree"))
        assertTrue(FileNames.matches("Rental Agreement", "  RENTAL "))
        assertTrue(FileNames.matches("Anything", ""))
        assertTrue(FileNames.matches("Anything", "   "))
        assertFalse(FileNames.matches("Rental Agreement", "invoice"))
    }
}

class GeometryTest {
    @Test fun `full quad is convex has unit area and is full frame`() {
        assertTrue(Quad.FULL.isConvex())
        assertEquals(1f, Quad.FULL.area(), 1e-6f)
        assertTrue(Quad.FULL.isFullFrame())
        assertFalse(Quad.FULL.withPoint(0, Pt(0.1f, 0.1f)).isFullFrame())
    }

    @Test fun `crossed or collapsed quads are invalid`() {
        val bowtie = Quad(Pt(0f, 0f), Pt(1f, 1f), Pt(1f, 0f), Pt(0f, 1f))
        assertFalse(bowtie.isConvex())
        val collapsed = Quad(Pt(0.5f, 0.5f), Pt(0.5f, 0.5f), Pt(0.5f, 0.5f), Pt(0.5f, 0.5f))
        assertFalse(collapsed.isValidCrop())
        val tiny = Quad(Pt(0.1f, 0.1f), Pt(0.15f, 0.1f), Pt(0.15f, 0.15f), Pt(0.1f, 0.15f))
        assertFalse(tiny.isValidCrop())
        assertTrue(Quad.FULL.isValidCrop())
    }

    @Test fun `opposite winding is rejected even though it is convex`() {
        val mirrored = Quad(Pt(0f, 0f), Pt(0f, 1f), Pt(1f, 1f), Pt(1f, 0f))
        val rotated180 = Quad(Pt(1f, 1f), Pt(1f, 0f), Pt(0f, 0f), Pt(0f, 1f))
        assertTrue(mirrored.isConvex())
        assertTrue(rotated180.isConvex())
        assertFalse(mirrored.isValidCrop())
        assertFalse(rotated180.isValidCrop())
        assertTrue(Quad.FULL.signedArea() > 0f)
    }

    @Test fun `concave quad is invalid`() {
        val dart = Quad(Pt(0f, 0f), Pt(1f, 0f), Pt(0.5f, 0.2f), Pt(0f, 1f))
        assertFalse(dart.isConvex())
    }

    @Test fun `storage round trips and rejects garbage`() {
        val q = Quad(Pt(0.1f, 0.2f), Pt(0.9f, 0.15f), Pt(0.95f, 0.85f), Pt(0.05f, 0.9f))
        assertEquals(q, Quad.fromStorage(q.toStorage()))
        assertEquals(q, Quad.fromFloats(q.toFloats()))
        assertNull(Quad.fromStorage("1,2,3"))
        assertNull(Quad.fromStorage("a,b,c,d,e,f,g,h"))
    }

    @Test fun `ordered sorts scrambled points to tl tr br bl`() {
        val q = Quad.ordered(listOf(Pt(0.9f, 0.9f), Pt(0.1f, 0.9f), Pt(0.1f, 0.1f), Pt(0.9f, 0.1f)))
        assertEquals(Pt(0.1f, 0.1f), q.tl)
        assertEquals(Pt(0.9f, 0.1f), q.tr)
        assertEquals(Pt(0.9f, 0.9f), q.br)
        assertEquals(Pt(0.1f, 0.9f), q.bl)
    }

    @Test fun `coerceIn01 clamps escaped points`() {
        val q = Quad(Pt(-0.2f, 0f), Pt(1.3f, 0f), Pt(1f, 1.1f), Pt(0f, 1f)).coerceIn01()
        assertEquals(0f, q.tl.x, 0f)
        assertEquals(1f, q.tr.x, 0f)
        assertEquals(1f, q.br.y, 0f)
    }
}
