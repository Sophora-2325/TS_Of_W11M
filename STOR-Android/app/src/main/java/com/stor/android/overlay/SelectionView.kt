package com.stor.android.overlay

import android.content.Context
import android.graphics.*
import android.view.MotionEvent
import android.view.View
import kotlin.math.abs

/** Frozen image, four independently adjustable corners; no OCR runs during a drag. */
class SelectionView(context: Context, private val image: Bitmap, val changed: (PixelCrop) -> Unit) : View(context) {
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val selection = RectF()
    private val imageBounds = RectF()
    private var coordinates: ImageCoordinates? = null
    private var anchorX = 0f
    private var anchorY = 0f
    private var draggingCorner = -1
    private val handleRadius = 8 * resources.displayMetrics.density

    init {
        contentDescription = "截图框选区，拖动选择文字；可拖动四个角调整范围"
        isFocusable = true
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        coordinates = ImageCoordinates(image.width, image.height, w, h)
        coordinates!!.let { imageBounds.set(it.left, it.top, it.right, it.bottom) }
        selection.setEmpty()
    }

    fun selectAll() {
        val c = coordinates ?: return
        selection.set(c.left, c.top, c.right, c.bottom)
        report()
        invalidate()
    }

    override fun onDraw(canvas: Canvas) {
        val c = coordinates ?: return
        canvas.drawColor(Color.BLACK)
        paint.color = Color.WHITE
        paint.style = Paint.Style.FILL
        canvas.drawBitmap(image, null, imageBounds, paint)
        paint.color = 0x99000000.toInt()
        canvas.save()
        canvas.clipOutRect(selection)
        canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), paint)
        canvas.restore()
        if (!selection.isEmpty) {
            paint.color = 0xffc8e0ad.toInt()
            paint.style = Paint.Style.STROKE
            paint.strokeWidth = 2 * resources.displayMetrics.density
            canvas.drawRect(selection, paint)
            paint.style = Paint.Style.FILL
            canvas.drawCircle(selection.left, selection.top, handleRadius, paint)
            canvas.drawCircle(selection.right, selection.top, handleRadius, paint)
            canvas.drawCircle(selection.right, selection.bottom, handleRadius, paint)
            canvas.drawCircle(selection.left, selection.bottom, handleRadius, paint)
        }
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        val c = coordinates ?: return false
        val x = event.x.coerceIn(c.left, c.right)
        val y = event.y.coerceIn(c.top, c.bottom)
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                draggingCorner = if (selection.isEmpty) -1 else corners().indexOfFirst {
                    abs(it.first - x) < handleRadius * 3 && abs(it.second - y) < handleRadius * 3
                }
                if (draggingCorner >= 0) {
                    val opposite = corners()[(draggingCorner + 2) % 4]
                    anchorX = opposite.first; anchorY = opposite.second
                } else { anchorX = x; anchorY = y }
                selection.set(minOf(anchorX, x), minOf(anchorY, y), maxOf(anchorX, x), maxOf(anchorY, y))
            }
            MotionEvent.ACTION_MOVE, MotionEvent.ACTION_UP -> {
                selection.set(minOf(anchorX, x), minOf(anchorY, y), maxOf(anchorX, x), maxOf(anchorY, y))
                if (event.actionMasked == MotionEvent.ACTION_UP) performClick()
            }
            MotionEvent.ACTION_CANCEL -> { return true }
        }
        invalidate()
        report()
        return true
    }

    override fun performClick(): Boolean { super.performClick(); return true }
    private fun corners() = listOf(selection.left to selection.top, selection.right to selection.top,
        selection.right to selection.bottom, selection.left to selection.bottom)
    private fun report() {
        coordinates?.let { changed(it.crop(selection.left, selection.top, selection.right, selection.bottom)) }
    }
}
