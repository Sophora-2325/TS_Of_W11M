package com.stor.android.ocr

import kotlin.math.ceil
import kotlin.math.round

data class DecodedLine(val text: String, val confidence: Float)

object OcrMath {
    private val mean = floatArrayOf(.485f, .456f, .406f)
    private val std = floatArrayOf(.229f, .224f, .225f)

    // Official det config uses BGR, not RGB. Resize is performed with OpenCV.
    fun detectorValue(channel: Int, byte: Int) = (byte / 255f - mean[channel]) / std[channel]

    fun detectorSize(width: Int, height: Int): Pair<Int, Int> {
        val scale = minOf(1.0, 1280.0 / maxOf(width, height))
        return maxOf(32, (round((width * scale).toInt() / 32.0) * 32).toInt()) to
            maxOf(32, (round((height * scale).toInt() / 32.0) * 32).toInt())
    }

    fun recognitionSize(width: Int, height: Int): Pair<Int, Int> {
        val resized = ceil(48.0 * width / height).toInt()
        return resized to maxOf(320, (48.0 * width / height).toInt())
    }

    /** CTC blank=0; repeated labels separated by a blank remain repeated characters. */
    fun decode(probabilities: FloatArray, steps: Int, classes: Int, dictionary: List<String>): DecodedLine {
        val text = StringBuilder()
        var previous = -1
        var score = 0f
        var count = 0
        for (step in 0 until steps) {
            val offset = step * classes
            var best = 0
            for (label in 1 until classes) {
                if (probabilities[offset + label] > probabilities[offset + best]) best = label
            }
            if (best != 0 && best != previous) {
                text.append(dictionary[best])
                score += probabilities[offset + best]
                count++
            }
            previous = best
        }
        return DecodedLine(text.toString(), if (count == 0) 0f else score / count)
    }
}
