package com.stor.android.overlay

import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.min

data class PixelCrop(val left: Int, val top: Int, val right: Int, val bottom: Int) {
    val width get() = right - left
    val height get() = bottom - top
}

/** The same fitted rectangle is used for drawing and touch-to-pixel conversion. */
class ImageCoordinates(val imageWidth: Int, val imageHeight: Int, viewWidth: Int, viewHeight: Int) {
    val scale = min(viewWidth.toFloat() / imageWidth, viewHeight.toFloat() / imageHeight)
    val left = (viewWidth - imageWidth * scale) / 2f
    val top = (viewHeight - imageHeight * scale) / 2f
    val right = left + imageWidth * scale
    val bottom = top + imageHeight * scale

    fun crop(x1: Float, y1: Float, x2: Float, y2: Float): PixelCrop = PixelCrop(
        floor((minOf(x1, x2) - left).toDouble() * imageWidth / (right - left)).toInt().coerceIn(0, imageWidth),
        floor((minOf(y1, y2) - top).toDouble() * imageHeight / (bottom - top)).toInt().coerceIn(0, imageHeight),
        ceil((maxOf(x1, x2) - left).toDouble() * imageWidth / (right - left)).toInt().coerceIn(0, imageWidth),
        ceil((maxOf(y1, y2) - top).toDouble() * imageHeight / (bottom - top)).toInt().coerceIn(0, imageHeight),
    )
}
