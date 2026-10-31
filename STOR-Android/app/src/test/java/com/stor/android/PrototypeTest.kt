package com.stor.android

import com.stor.android.ocr.OcrMath
import com.stor.android.overlay.ImageCoordinates
import com.stor.android.overlay.PixelCrop
import org.junit.Assert.*
import org.junit.Test

class PrototypeTest {
    @Test fun portraitLetterboxingMapsBackToOriginalPixels() {
        val mapping = ImageCoordinates(1080, 2400, 360, 720)
        assertEquals(18f, mapping.left, .001f)
        assertEquals(PixelCrop(0, 0, 1080, 2400), mapping.crop(18f, 0f, 342f, 720f))
        assertEquals(PixelCrop(240, 600, 840, 1800), mapping.crop(90f, 180f, 270f, 540f))
    }
    @Test fun landscapeLetterboxAndReverseDragAreConsistent() {
        val mapping = ImageCoordinates(2400, 1080, 720, 360)
        assertEquals(18f, mapping.top, .001f)
        assertEquals(mapping.crop(180f, 90f, 540f, 270f), mapping.crop(540f, 270f, 180f, 90f))
        assertEquals(PixelCrop(0, 0, 2400, 1080), mapping.crop(-100f, -100f, 900f, 600f))
    }
    @Test fun selectionRoundsOutwardsWithoutDroppingEdgePixels() {
        assertEquals(PixelCrop(0, 0, 2, 2), ImageCoordinates(100, 100, 300, 300).crop(1f, 1f, 4f, 4f))
    }
    @Test fun detectorUsesOfficialImageNetNormalizationInBgrOrder() {
        assertEquals(-2.117904f, OcrMath.detectorValue(0, 0), .00001f)
        assertEquals(2.428571f, OcrMath.detectorValue(1, 255), .00001f)
        assertEquals(2.64f, OcrMath.detectorValue(2, 255), .00001f)
    }
    @Test fun detectorDimensionsMatchNumpyBankersRounding() {
        assertEquals(1280 to 640, OcrMath.detectorSize(2560, 1280))
        assertEquals(128 to 64, OcrMath.detectorSize(144, 80))
        assertEquals(32 to 32, OcrMath.detectorSize(12, 20))
    }
    @Test fun recognitionKeepsLongLinesAndZeroPadding() {
        assertEquals(192 to 320, OcrMath.recognitionSize(400, 100))
        assertEquals(960 to 960, OcrMath.recognitionSize(1000, 50))
    }
    @Test fun ctcCollapsesAdjacentRepeatsButKeepsRepeatsAfterBlank() {
        val labels = listOf("", "中", "A", " ")
        val tokens = intArrayOf(0, 1, 1, 0, 1, 3, 2, 2, 0)
        val data = FloatArray(tokens.size * 4) { .01f }
        tokens.forEachIndexed { index, token -> data[index * 4 + token] = .97f }
        val result = OcrMath.decode(data, tokens.size, 4, labels)
        assertEquals("中中 A", result.text)
        assertEquals(.97f, result.confidence, .00001f)
    }
    @Test fun blankOnlyOutputHasNoTextOrConfidence() {
        val result = OcrMath.decode(floatArrayOf(.99f, .01f, .98f, .02f), 2, 2, listOf("", "A"))
        assertEquals("", result.text)
        assertEquals(0f, result.confidence)
    }
}
