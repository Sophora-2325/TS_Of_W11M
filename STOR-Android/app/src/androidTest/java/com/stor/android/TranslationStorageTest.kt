package com.stor.android

import android.content.Context
import android.content.ContextWrapper
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.stor.android.translate.*
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class TranslationStorageTest {
    private fun isolatedContext(): Context {
        val target = InstrumentationRegistry.getInstrumentation().targetContext
        return object : ContextWrapper(target) {
            override fun getApplicationContext(): Context = this
            override fun getFilesDir(): java.io.File = java.io.File(target.filesDir, "p3-storage-test").apply { mkdirs() }
        }
    }

    @Test fun keyIsEncryptedAndCanBeReadByNewStoreInstance() = runBlocking {
        // Instrumentation runs with the target UID: use a separate target subdirectory.
        val isolated = isolatedContext()
        val settings = TranslationSettings("https://example.invalid/v1", "test-model", "stor-synthetic-storage-key", TargetLanguage.JAPANESE)
        TranslationSettingsStore(isolated).save(settings)
        assertEquals(settings, TranslationSettingsStore(isolated).read())
        val file = isolated.filesDir.resolve("datastore/translation.preferences_pb")
        val bytes = file.readBytes().toString(Charsets.ISO_8859_1)
        assertFalse(bytes.contains(settings.apiKey))
        assertTrue(bytes.contains("api_key_ciphertext"))
    }

    @Test fun previouslySavedKeySurvivesNewProcess() = runBlocking {
        val saved = TranslationSettingsStore(isolatedContext()).read()
        assertEquals("stor-synthetic-storage-key", saved.apiKey)
        assertEquals(TargetLanguage.JAPANESE, saved.targetLanguage)
    }
}
