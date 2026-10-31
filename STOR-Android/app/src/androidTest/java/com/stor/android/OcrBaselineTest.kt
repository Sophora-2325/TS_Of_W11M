package com.stor.android

import android.graphics.BitmapFactory
import android.os.Build
import android.os.SystemClock
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.stor.android.ocr.PaddleOcr
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class OcrBaselineTest {
    @Test fun syntheticSamplesMatchDesktopOutput() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val assets = instrumentation.context.assets
        val reference = JSONArray(assets.open("fixtures/reference.json").bufferedReader().use { it.readText() })
        val started = SystemClock.elapsedRealtime()
        val ocr = PaddleOcr.open(instrumentation.targetContext)
        val loadMs = SystemClock.elapsedRealtime() - started
        val results = JSONArray()
        ocr.use {
            for (index in 0 until reference.length()) {
                val sample = reference.getJSONObject(index)
                val image = assets.open("fixtures/${sample.getString("file")}").use(BitmapFactory::decodeStream)
                val result = ocr.recognize(image)
                image.recycle()
                results.put(JSONObject().put("language", sample.getString("language"))
                    .put("text", result.text).put("elapsedMs", result.elapsedMs)
                    .put("desktopMatch", result.text == sample.getString("desktop")))
            }
        }
        val report = JSONObject().put("device", "${Build.MANUFACTURER} ${Build.MODEL}")
            .put("sdk", Build.VERSION.SDK_INT).put("loadMs", loadMs).put("samples", results)
        instrumentation.targetContext.filesDir.resolve("ocr-baseline.json").writeText(report.toString(2))
        // Save all observed results before failing a comparison.
        for (index in 0 until results.length()) {
            assertEquals(reference.getJSONObject(index).getString("language"),
                reference.getJSONObject(index).getString("desktop"), results.getJSONObject(index).getString("text"))
        }
    }
}
