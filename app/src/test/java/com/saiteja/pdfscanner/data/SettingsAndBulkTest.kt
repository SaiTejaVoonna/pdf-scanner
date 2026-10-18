package com.saiteja.pdfscanner.data

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.saiteja.pdfscanner.domain.PageFilter
import com.saiteja.pdfscanner.domain.Pt
import com.saiteja.pdfscanner.domain.Quad
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class SettingsAndBulkTest {
    private lateinit var context: Context
    private lateinit var db: AppDatabase
    private lateinit var files: FileStore
    private lateinit var repo: DocumentRepository

    @Before fun setUp() {
        context = ApplicationProvider.getApplicationContext()
        db = Room.inMemoryDatabaseBuilder(context, AppDatabase::class.java).allowMainThreadQueries().build()
        files = FileStore(context)
        repo = DocumentRepository(db, files)
    }

    @After fun tearDown() = db.close()

    @Test fun `settings default to camera auto-crop on and import auto-crop off`() {
        val s = AppSettings(context).current
        assertTrue(s.autoCropCamera)
        assertFalse(s.autoCropImport)
        assertEquals(PageFilter.ORIGINAL, s.defaultFilter)
    }

    @Test fun `settings persist across instances`() {
        AppSettings(context).update { it.copy(autoCropCamera = false, autoCropImport = true, defaultFilter = PageFilter.ENHANCED) }
        val again = AppSettings(context)
        assertFalse(again.current.autoCropCamera)
        assertTrue(again.current.autoCropImport)
        assertEquals(PageFilter.ENHANCED, again.current.defaultFilter)
        assertEquals(again.current, again.state.value)
    }

    @Test fun `a stored unsupported default filter falls back to original`() {
        context.getSharedPreferences("settings", Context.MODE_PRIVATE).edit().putString("default_filter", "BLACK_WHITE").commit()
        assertEquals(PageFilter.ORIGINAL, AppSettings(context).current.defaultFilter)
        context.getSharedPreferences("settings", Context.MODE_PRIVATE).edit().putString("default_filter", "nonsense").commit()
        assertEquals(PageFilter.ORIGINAL, AppSettings(context).current.defaultFilter)
    }

    private suspend fun doc(vararg ids: String): String {
        val d = repo.createDraft("d")
        ids.forEach { id -> files.pageFile(d.id, "$id.jpg").writeText("x"); repo.addPage(d.id, "$id.jpg", pageId = id) }
        return d.id
    }

    @Test fun `updatePages saves all edits in one go`() = runBlocking {
        val id = doc("a", "b", "c")
        val crop = Quad(Pt(.1f, .1f), Pt(.9f, .1f), Pt(.9f, .9f), Pt(.1f, .9f))
        repo.updatePages(repo.getPages(id).filter { it.id != "b" }.map { it.copy(filter = PageFilter.ENHANCED, corners = crop) })
        val pages = repo.getPages(id).associateBy { it.id }
        assertEquals(PageFilter.ENHANCED, pages["a"]!!.filter)
        assertEquals(PageFilter.ORIGINAL, pages["b"]!!.filter)
        assertEquals(crop, pages["c"]!!.corners)
        repo.updatePages(emptyList()) // no-op
    }

    @Test fun `removePages deletes files, compacts positions and handles unknown ids`() = runBlocking {
        val id = doc("a", "b", "c", "d")
        repo.removePages(listOf("b", "d", "ghost"))
        assertEquals(listOf("a", "c"), repo.getPages(id).map { it.id })
        assertEquals(listOf(0, 1), repo.getPages(id).map { it.position })
        assertFalse(files.pageFile(id, "b.jpg").exists())
        assertTrue(files.pageFile(id, "a.jpg").exists())
        repo.removePages(emptyList())
    }
}
