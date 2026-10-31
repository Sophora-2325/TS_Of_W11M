package com.stor.android

import android.content.ClipboardManager
import android.content.Intent
import android.graphics.Bitmap
import android.os.SystemClock
import android.view.View
import android.view.ViewGroup
import android.view.inspector.WindowInspector
import android.view.inputmethod.InputMethodManager
import android.widget.*
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.SdkSuppress
import androidx.test.platform.app.InstrumentationRegistry
import com.stor.android.overlay.*
import com.stor.android.translate.*
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

/** Synthetic native rendering only; never creates a translation client. */
@RunWith(AndroidJUnit4::class)
@SdkSuppress(minSdkVersion = 29)
class UiRefreshTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private val context get() = instrumentation.targetContext
    private fun nodes(view: View): List<View> = listOf(view) +
        if (view is ViewGroup) (0 until view.childCount).flatMap { nodes(view.getChildAt(it)) } else emptyList()
    private fun settle() { instrumentation.waitForIdleSync(); SystemClock.sleep(350) }

    @Test fun syntheticOverlayStatesAndActions() {
        check(context.packageName.endsWith(".uipreview")) { "Run only with -I tools/ui-preview.init.gradle" }
        val activity = instrumentation.startActivitySync(Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        settle()
        lateinit var overlay: OverlayController
        var requests = 0
        var edits = 0
        var settings = 0
        var adjusted = 0
        var captured = 0
        var closed = 0
        val directory = File(context.getExternalFilesDir(null), "ui-refresh").apply { mkdirs() }
        val report = StringBuilder()
        val metrics = context.resources.displayMetrics
        val short = ResultContent("おはよう", "本地识别 102 ms · 可编辑", TargetLanguage.CHINESE)
        lateinit var actions: ResultActions
        instrumentation.runOnMainSync {
            overlay = OverlayController(context) {}
            actions = ResultActions(
                inputChanged = { _, _ -> edits++; overlay.updateTranslation(TranslationUiState()) },
                translate = { requests++; overlay.updateTranslation(TranslationUiState("早", "正在翻译…", true)) },
                cancelTranslation = { overlay.updateTranslation(TranslationUiState("早", "已取消，可手动重试", retry = true)) },
                settings = { settings++ }, adjust = { adjusted++ }, capture = { captured++ },
                dismiss = { closed++; overlay.hide() },
            )
            overlay.showResult(short, TranslationUiState(), actions, metrics.widthPixels, metrics.heightPixels)
        }
        fun root() = WindowInspector.getGlobalWindowViews().last { it is LinearLayout && nodes(it).any { v -> v is TextView && v.text.toString() == "屏幕翻译" } }
        fun click(text: String) {
            instrumentation.runOnMainSync {
                val view = nodes(root()).first { it.visibility == View.VISIBLE && ((it is TextView && it.text.toString() == text) || it.contentDescription?.toString() == text) }
                assertTrue(view.performClick())
            }
            settle()
        }
        fun snapshot(name: String) {
            settle()
            instrumentation.runOnMainSync {
                val card = root()
                val scroll = nodes(card).filterIsInstance<ScrollView>().single()
                report.appendLine(name + ": " + card.width + "x" + card.height + "; scroll=" + (scroll.canScrollVertically(1) || scroll.canScrollVertically(-1)))
                assertTrue(card.width > 0 && card.height > 0)
                assertTrue(card.height <= metrics.heightPixels - 80 * metrics.density)
                assertTrue(nodes(card).filterIsInstance<Button>().filter { it.visibility == View.VISIBLE }.all { it.height >= 48 * metrics.density })
            }
            instrumentation.uiAutomation.takeScreenshot().let { bitmap ->
                File(directory, name + ".png").outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
                bitmap.recycle()
            }
        }
        try {
            snapshot("overlay-idle")
            if (InstrumentationRegistry.getArguments().getString("snapshotOnly") == "true") {
                instrumentation.runOnMainSync { overlay.updateTranslation(TranslationUiState("早上好。", "翻译完成")) }
                snapshot("overlay-completed")
                instrumentation.runOnMainSync {
                    overlay.showResult(short.copy(source = "Long source. ".repeat(100)),
                        TranslationUiState("固定长文本，用于检查滚动。".repeat(60), "翻译完成"), actions, metrics.widthPixels, metrics.heightPixels)
                }
                snapshot("overlay-long")
                report.appendLine("PASS: constrained-height preview; no network client")
                return
            }
            instrumentation.runOnMainSync {
                assertFalse(nodes(root()).any { it is Button && it.text == "复制译文" && it.visibility == View.VISIBLE })
                assertFalse(nodes(root()).filterIsInstance<ScrollView>().single().canScrollVertically(1))
            }
            click("复制原文")
            instrumentation.runOnMainSync { assertEquals(short.source, context.getSystemService(ClipboardManager::class.java).primaryClip!!.getItemAt(0).text.toString()) }
            click("翻译"); snapshot("overlay-running")
            click("取消翻译"); snapshot("overlay-cancelled")
            click("复制译文")
            instrumentation.runOnMainSync { assertEquals("早", context.getSystemService(ClipboardManager::class.java).primaryClip!!.getItemAt(0).text.toString()) }
            click("重试")
            instrumentation.runOnMainSync { overlay.updateTranslation(TranslationUiState("早上好。", "翻译完成")) }
            snapshot("overlay-completed")
            click("复制译文"); click("编辑原文"); snapshot("overlay-edit-keyboard")
            instrumentation.runOnMainSync {
                val edit = nodes(root()).filterIsInstance<EditText>().single()
                edit.setText("Good morning.")
                context.getSystemService(InputMethodManager::class.java).hideSoftInputFromWindow(edit.windowToken, 0)
                nodes(root()).filterIsInstance<Spinner>().single().setSelection(TargetLanguage.ENGLISH.ordinal)
            }
            settle()
            assertTrue(edits >= 2)
            click("设置"); click("调选区"); click("重截图")
            assertEquals(1, settings); assertEquals(1, adjusted); assertEquals(1, captured)
            instrumentation.runOnMainSync {
                overlay.showResult(short.copy(source = "Long source paragraph. ".repeat(100)),
                    TranslationUiState("这是固定的长文本预览，用于检查滚动和操作区。".repeat(60), "翻译完成"), actions, metrics.widthPixels, metrics.heightPixels)
            }
            snapshot("overlay-long")
            instrumentation.runOnMainSync {
                val scroll = nodes(root()).filterIsInstance<ScrollView>().single()
                assertTrue(scroll.canScrollVertically(1))
                scroll.fullScroll(View.FOCUS_DOWN)
            }
            snapshot("overlay-long-bottom")
            instrumentation.runOnMainSync { overlay.updateTranslation(TranslationUiState("保留的部分译文", "本地模拟失败，请手动重试", retry = true)) }
            snapshot("overlay-error-partial")
            click("关闭")
            assertEquals(1, closed); assertEquals(2, requests)
            report.appendLine("PASS: all local overlay states and action callbacks; no network client")
        } finally {
            instrumentation.runOnMainSync { overlay.hide(); activity.finish() }
            File(directory, "overlay-report.txt").writeText(report.toString())
        }
    }
}
