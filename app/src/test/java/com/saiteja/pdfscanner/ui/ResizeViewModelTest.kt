package com.saiteja.pdfscanner.ui

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.net.Uri
import androidx.lifecycle.SavedStateHandle
import com.saiteja.pdfscanner.TestFixtures
import com.saiteja.pdfscanner.TestFixtures.awaitMatch
import com.saiteja.pdfscanner.domain.ImageFormat
import com.saiteja.pdfscanner.domain.ResizePreset
import com.saiteja.pdfscanner.ui.tools.ResizeViewModel
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.ByteArrayOutputStream
import java.io.File

@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34])
class ResizeViewModelTest {
    @Before fun setUp() = TestFixtures.useUnconfinedMain()
    @After fun tearDown() = TestFixtures.resetMain()

    private fun photo(c: com.saiteja.pdfscanner.AppContainer, name: String, w: Int, h: Int): File {
        val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        val rnd = java.util.Random(w.toLong())
        for (y in 0 until h step 2) for (x in 0 until w step 2) bmp.setPixel(x, y, Color.rgb(rnd.nextInt(256), rnd.nextInt(256), rnd.nextInt(256)))
        return File(c.fileStore.captureDir, name).also { f -> f.outputStream().use { bmp.compress(Bitmap.CompressFormat.JPEG, 95, it) } }
    }

    @Test
    fun `resizer scales to the longest side and recompresses`() = runBlocking {
        val c = TestFixtures.container()
        val file = photo(c, "big.jpg", 2400, 1600)
        val out = ByteArrayOutputStream()
        val written = c.resizer.resize(Uri.fromFile(file), 800, ImageFormat.JPEG, 60, out)
        assertEquals(written, out.size().toLong())
        val decoded = BitmapFactory.decodeByteArray(out.toByteArray(), 0, out.size())
        assertEquals(800, decoded.width)
        assertEquals(533.0, decoded.height.toDouble(), 1.0)
        assertTrue("smaller than the source", written < file.length())
    }

    @Test
    fun `resizer never enlarges and can write png`() = runBlocking {
        val c = TestFixtures.container()
        val file = photo(c, "small.jpg", 400, 300)
        val out = ByteArrayOutputStream()
        c.resizer.resize(Uri.fromFile(file), 2048, ImageFormat.PNG, 100, out)
        val decoded = BitmapFactory.decodeByteArray(out.toByteArray(), 0, out.size())
        assertEquals(400, decoded.width)
        assertEquals(300, decoded.height)
        // PNG signature
        assertEquals(0x89, out.toByteArray()[0].toInt() and 0xFF)
    }

    @Test
    fun `resizer reports an unreadable image as an error`() {
        val c = TestFixtures.container()
        val bad = File(c.fileStore.captureDir, "bad.jpg").apply { writeText("nope") }
        try {
            runBlocking { c.resizer.resize(Uri.fromFile(bad), 800, ImageFormat.JPEG, 80, ByteArrayOutputStream()) }
            throw AssertionError("expected failure")
        } catch (e: com.saiteja.pdfscanner.imaging.ImageImportException) {
            // expected
        }
    }

    @Test
    fun `view model keeps the picked images and options in saved state`() = runBlocking {
        val c = TestFixtures.container()
        val a = photo(c, "a.jpg", 300, 200)
        val b = photo(c, "b.jpg", 300, 200)
        val handle = SavedStateHandle()
        val vm = ResizeViewModel(c, handle)
        vm.addImages(listOf(Uri.fromFile(a), Uri.fromFile(b), Uri.fromFile(a))) // duplicate is ignored
        assertEquals(2, vm.state.awaitMatch { it.images.size == 2 }.images.size)
        vm.setPreset(ResizePreset.SMALL); vm.setFormat(ImageFormat.PNG); vm.setQuality(70)
        vm.remove(Uri.fromFile(b))

        val restored = ResizeViewModel(c, handle)
        val s = restored.state.awaitMatch { it.images.size == 1 }
        assertEquals(ResizePreset.SMALL, s.preset)
        assertEquals(ImageFormat.PNG, s.format)
        assertEquals(70, s.quality)
        assertEquals("a.jpg", s.images.single().name)
    }
}
