package com.stor.android.overlay

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.res.Configuration
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.RippleDrawable
import android.content.res.ColorStateList
import androidx.core.content.res.ResourcesCompat
import com.stor.android.R
import android.view.*
import android.view.inputmethod.InputMethodManager
import android.widget.*
import androidx.core.widget.doAfterTextChanged
import com.stor.android.translate.TargetLanguage
import com.stor.android.translate.TranslationUiState
import kotlin.math.abs

data class ResultContent(val source: String, val detail: String, val language: TargetLanguage)
data class ResultActions(
    val inputChanged: (String, TargetLanguage) -> Unit,
    val translate: () -> Unit,
    val cancelTranslation: () -> Unit,
    val settings: () -> Unit,
    val adjust: () -> Unit,
    val capture: () -> Unit,
    val dismiss: () -> Unit,
)

/** The service owns one visible overlay: bubble, selection or editable result. */
class OverlayController(baseContext: Context, private val onCapture: () -> Unit) {
    private val context = ContextThemeWrapper(baseContext,
        if (baseContext.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK == Configuration.UI_MODE_NIGHT_YES)
            android.R.style.Theme_Material_NoActionBar else android.R.style.Theme_Material_Light_NoActionBar)
    private val windows = context.getSystemService(WindowManager::class.java)
    private var current: View? = null
    private var resultUpdater: ((TranslationUiState) -> Unit)? = null
    private val density = context.resources.displayMetrics.density
    private val inkColor get() = context.getColor(R.color.stor_ink)
    private val surfaceColor get() = context.getColor(R.color.stor_surface)
    private val mutedColor get() = context.getColor(R.color.stor_muted)
    private val primaryColor get() = context.getColor(R.color.stor_primary)
    private val outlineColor get() = context.getColor(R.color.stor_outline)
    private val font = ResourcesCompat.getFont(context, R.font.noto_sans_sc)!!
    private var bubbleX = 0
    private var bubbleY = dp(180)
    private var dockRight = true

    private fun bounds() = if (android.os.Build.VERSION.SDK_INT >= 30) windows.maximumWindowMetrics.bounds
        else android.graphics.Rect(0, 0, context.resources.displayMetrics.widthPixels, context.resources.displayMetrics.heightPixels)

    fun hide() {
        current?.let { view ->
            context.getSystemService(InputMethodManager::class.java).hideSoftInputFromWindow(view.windowToken, 0)
            windows.removeViewImmediate(view)
        }
        current = null
        resultUpdater = null
    }

    fun showBubble() {
        hide()
        val bounds = bounds()
        // Persist the edge, not the old screen's horizontal pixel coordinate.
        bubbleX = if (dockRight) bounds.width() - dp(64) else dp(8)
        bubbleX = bubbleX.coerceIn(0, maxOf(0, bounds.width() - dp(56)))
        bubbleY = bubbleY.coerceIn(dp(32), maxOf(dp(32), bounds.height() - dp(112)))
        val button = Button(context).apply {
            text = "译"; textSize = 20f; typeface = font; fontVariationSettings = "'wght' 400"; includeFontPadding = false; setTextColor(context.getColor(R.color.stor_on_primary))
            contentDescription = "截取当前画面并框选文字，可拖动移动位置"
            background = GradientDrawable().apply { setColor(primaryColor); cornerRadius = dp(20).toFloat() }
            setOnClickListener { onCapture() }
        }
        val params = params(dp(56), dp(56), false).apply {
            gravity = Gravity.TOP or Gravity.LEFT
            x = bubbleX; y = bubbleY
        }
        var startX = 0f; var startY = 0f
        var originalX = 0; var originalY = 0
        var moved = false
        val slop = ViewConfiguration.get(context).scaledTouchSlop
        button.setOnTouchListener { view, event ->
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    startX = event.rawX; startY = event.rawY; originalX = params.x; originalY = params.y; moved = false
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = event.rawX - startX; val dy = event.rawY - startY
                    if (abs(dx) > slop || abs(dy) > slop) moved = true
                    if (moved) {
                        params.x = (originalX + dx.toInt()).coerceIn(0, maxOf(0, bounds.width() - dp(56)))
                        params.y = (originalY + dy.toInt()).coerceIn(dp(32), maxOf(dp(32), bounds.height() - dp(112)))
                        windows.updateViewLayout(button, params)
                    }
                }
                MotionEvent.ACTION_UP -> {
                    if (moved) {
                        dockRight = params.x >= bounds.width() / 2
                        bubbleX = if (dockRight) bounds.width() - dp(64) else dp(8)
                        bubbleY = params.y; params.x = bubbleX
                        windows.updateViewLayout(button, params)
                    } else view.performClick()
                }
            }
            true
        }
        show(button, params)
    }

    fun showSelection(image: Bitmap, cancel: () -> Unit, recognize: (PixelCrop) -> Unit) {
        hide()
        var crop = PixelCrop(0, 0, 0, 0)
        val root = column().apply { setBackgroundColor(Color.BLACK) }
        val label = label("拖动框选文字，拖动四角可调整", 15f).apply { setTextColor(Color.WHITE); setPadding(dp(16), dp(12), dp(16), dp(12)) }
        val confirm = button("识别") { recognize(crop) }.apply { isEnabled = false }
        val selection = SelectionView(context, image) {
            crop = it
            confirm.isEnabled = it.width >= 8 && it.height >= 8
            label.text = if (confirm.isEnabled) "选区 ${it.width} × ${it.height} · 拖动四角调整" else "拖动框选文字，拖动四角可调整"
        }
        root.addView(label)
        root.addView(selection, LinearLayout.LayoutParams(-1, 0, 1f))
        root.addView(row(listOf(button("取消", cancel), button("全选") { selection.selectAll() }, confirm)))
        root.setOnApplyWindowInsetsListener { view, insets ->
            if (android.os.Build.VERSION.SDK_INT >= 30) {
                val safe = insets.getInsets(WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout())
                view.setPadding(safe.left, safe.top, safe.right, safe.bottom)
            } else view.setPadding(insets.systemWindowInsetLeft, insets.systemWindowInsetTop, insets.systemWindowInsetRight, insets.systemWindowInsetBottom)
            insets
        }
        root.isFocusableInTouchMode = true
        root.setOnKeyListener { _, code, event ->
            if (code == KeyEvent.KEYCODE_BACK && event.action == KeyEvent.ACTION_UP) { cancel(); true } else false
        }
        show(root, params(-1, -1, true))
        root.requestFocus()
    }

    fun showResult(content: ResultContent, state: TranslationUiState, actions: ResultActions, screenWidth: Int, screenHeight: Int) {
        hide()
        // Keep the service-supplied dimensions: window metrics can lag projection rotation.
        val maxHeight = minOf(screenHeight - dp(80), dp(560))
        val card = object : LinearLayout(context) {
            init { orientation = VERTICAL }
            override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
                val available = if (MeasureSpec.getMode(heightMeasureSpec) == MeasureSpec.UNSPECIFIED) maxHeight
                    else minOf(maxHeight, MeasureSpec.getSize(heightMeasureSpec))
                super.onMeasure(widthMeasureSpec, MeasureSpec.makeMeasureSpec(available, MeasureSpec.AT_MOST))
            }
        }.apply {
            setPadding(dp(16), dp(12), dp(16), dp(12))
            background = GradientDrawable().apply {
                setColor(surfaceColor); cornerRadius = dp(24).toFloat(); setStroke(dp(1), outlineColor)
            }
        }
        card.addView(LinearLayout(context).apply {
            gravity = Gravity.CENTER_VERTICAL
            addView(label("屏幕翻译", 18f).apply { typeface = Typeface.create(font, 600, false); fontVariationSettings = "'wght' 600" }, LinearLayout.LayoutParams(0, -2, 1f))
            addView(icon(R.drawable.ic_x, "关闭", actions.dismiss), LinearLayout.LayoutParams(dp(48), dp(48)))
        })
        val edit = EditText(context).apply {
            setText(content.source); setTextColor(inkColor); setHintTextColor(mutedColor)
            typeface = font; fontVariationSettings = "'wght' 400"; includeFontPadding = false; hint = "可在这里修改识别原文"; textSize = 16f
            minLines = 1; maxLines = 4; minimumHeight = dp(48)
            background = null; setPadding(0, dp(8), 0, dp(8))
            inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_FLAG_MULTI_LINE
            setSelectAllOnFocus(false)
        }
        var selectedLanguage = content.language
        val selector = Spinner(context).apply {
            adapter = object : ArrayAdapter<String>(context, android.R.layout.simple_spinner_dropdown_item, TargetLanguage.entries.map { it.label }) {
                override fun getView(position: Int, convertView: View?, parent: ViewGroup): View =
                    (super.getView(position, convertView, parent) as TextView).apply {
                        typeface = font; fontVariationSettings = "'wght' 400"; includeFontPadding = false; textSize = 14f; setTextColor(inkColor)
                    }
                override fun getDropDownView(position: Int, convertView: View?, parent: ViewGroup): View =
                    (super.getDropDownView(position, convertView, parent) as TextView).apply {
                        typeface = font; fontVariationSettings = "'wght' 400"; includeFontPadding = false; textSize = 16f; setTextColor(inkColor); setBackgroundColor(surfaceColor); minimumHeight = dp(48)
                    }
            }
            setSelection(content.language.ordinal); contentDescription = "翻译目标语言"
            onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
                override fun onNothingSelected(parent: AdapterView<*>?) = Unit
                override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) {
                    val language = TargetLanguage.entries[position]
                    if (language != selectedLanguage) {
                        selectedLanguage = language
                        actions.inputChanged(edit.text.toString(), language)
                    }
                }
            }
        }
        card.addView(LinearLayout(context).apply {
            gravity = Gravity.CENTER_VERTICAL
            addView(label("译为", 12f).apply { setTextColor(mutedColor) })
            addView(selector, LinearLayout.LayoutParams(0, dp(48), 1f))
            addView(icon(R.drawable.ic_settings_2, "设置", actions.settings), LinearLayout.LayoutParams(dp(48), dp(48)))
        })
        val body = column()
        body.addView(View(context).apply { setBackgroundColor(outlineColor) }, LinearLayout.LayoutParams(-1, dp(1)))
        body.addView(LinearLayout(context).apply {
            gravity = Gravity.CENTER_VERTICAL
            addView(label("原文", 12f).apply { setTextColor(mutedColor) }, LinearLayout.LayoutParams(0, -2, 1f))
            addView(icon(R.drawable.ic_pencil_line, "编辑原文") {
                edit.requestFocus()
                context.getSystemService(InputMethodManager::class.java).showSoftInput(edit, InputMethodManager.SHOW_IMPLICIT)
            }, LinearLayout.LayoutParams(dp(48), dp(48)))
            addView(icon(R.drawable.ic_copy, "复制原文") {
                context.getSystemService(ClipboardManager::class.java).setPrimaryClip(ClipData.newPlainText("识别原文", edit.text.toString()))
                Toast.makeText(context, "已复制原文", Toast.LENGTH_SHORT).show()
            }, LinearLayout.LayoutParams(dp(48), dp(48)))
        })
        body.addView(edit, LinearLayout.LayoutParams(-1, -2))
        body.addView(label(content.detail, 12f).apply { setTextColor(mutedColor); setPadding(0, 0, 0, dp(12)) })
        body.addView(View(context).apply { setBackgroundColor(outlineColor) }, LinearLayout.LayoutParams(-1, dp(1)))
        body.addView(label("译文", 12f).apply { setTextColor(mutedColor); setPadding(0, dp(12), 0, dp(8)) })
        val message = label("", 12f).apply { setTextColor(mutedColor) }
        val translated = label("", 22f).apply {
            typeface = Typeface.create(font, 600, false); fontVariationSettings = "'wght' 600"
            setTextIsSelectable(true); setPadding(0, dp(8), 0, dp(8))
        }
        body.addView(message)
        body.addView(translated)
        body.addView(row(listOf(
            button("调选区", actions.adjust).apply { setCompoundDrawablesRelativeWithIntrinsicBounds(drawable(R.drawable.ic_scan, mutedColor), null, null, null) },
            button("重截图", actions.capture).apply { setCompoundDrawablesRelativeWithIntrinsicBounds(drawable(R.drawable.ic_camera, mutedColor), null, null, null) },
        )).apply { setPadding(0, dp(8), 0, dp(8)) })
        card.addView(ScrollView(context).apply { isFillViewport = false; addView(body) }, LinearLayout.LayoutParams(-1, -2, 1f))
        val start = button("翻译", actions.translate)
        val cancel = button("取消翻译", actions.cancelTranslation)
        var displayed = state
        val copy = button("复制译文") {
            context.getSystemService(ClipboardManager::class.java).setPrimaryClip(ClipData.newPlainText("译文", displayed.text))
            Toast.makeText(context, "已复制译文", Toast.LENGTH_SHORT).show()
        }
        card.addView(row(listOf(start, cancel, copy)))
        edit.doAfterTextChanged { actions.inputChanged(it.toString(), selectedLanguage) }
        resultUpdater = { updated ->
            displayed = updated
            message.text = updated.message
            message.setTextColor(if (updated.retry) context.getColor(R.color.stor_error) else mutedColor)
            translated.text = updated.text
            translated.visibility = if (updated.text.isBlank()) View.GONE else View.VISIBLE
            start.isEnabled = !updated.running && edit.text.isNotBlank()
            start.text = if (updated.retry) "重试" else "翻译"
            start.visibility = if (updated.running) View.GONE else View.VISIBLE
            cancel.visibility = if (updated.running) View.VISIBLE else View.GONE
            copy.visibility = if (updated.text.isBlank()) View.GONE else View.VISIBLE
            val completed = !updated.running && !updated.retry && updated.text.isNotBlank()
            styleButton(start, !completed)
            styleButton(cancel, true)
            styleButton(copy, completed)
        }
        updateTranslation(state)
        val params = params(minOf(screenWidth - dp(24), dp(560)), -2, true).apply {
            gravity = Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
            y = dp(12)
            softInputMode = WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE or WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_HIDDEN
        }
        show(card, params)
    }

    fun updateTranslation(state: TranslationUiState) { resultUpdater?.invoke(state) }

    fun showBusy(text: String, cancel: () -> Unit) {
        hide()
        val card = column().apply {
            setPadding(dp(24), dp(16), dp(24), dp(16)); setBackgroundColor(surfaceColor)
            addView(label(text, 16f)); addView(ProgressBar(context)); addView(button("取消", cancel))
        }
        show(card, params(minOf(bounds().width() - dp(32), dp(400)), -2, false))
    }

    private fun show(view: View, params: WindowManager.LayoutParams) { windows.addView(view, params); current = view }
    private fun params(width: Int, height: Int, focusable: Boolean) = WindowManager.LayoutParams(
        width, height, WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
        WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or if (focusable) 0 else WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
        PixelFormat.TRANSLUCENT,
    ).apply { gravity = Gravity.CENTER }
    private fun dp(value: Int) = (value * density).toInt()
    private fun column() = LinearLayout(context).apply { orientation = LinearLayout.VERTICAL }
    private fun label(value: String, size: Float) = TextView(context).apply { text = value; textSize = size; typeface = font; fontVariationSettings = "'wght' 400"; includeFontPadding = false; setTextColor(inkColor) }
    private fun drawable(resource: Int, color: Int) = context.getDrawable(resource)!!.mutate().apply {
        setTint(color); setBounds(0, 0, dp(18), dp(18))
    }
    private fun icon(resource: Int, description: String, action: () -> Unit) = ImageButton(context).apply {
        setImageDrawable(drawable(resource, mutedColor)); contentDescription = description
        setPadding(dp(13), dp(13), dp(13), dp(13)); scaleType = ImageView.ScaleType.FIT_CENTER
        background = RippleDrawable(ColorStateList.valueOf(outlineColor), null, GradientDrawable().apply { setColor(Color.WHITE); cornerRadius = dp(12).toFloat() })
        setOnClickListener { action() }
    }
    private fun styleButton(button: Button, primary: Boolean) {
        button.setTextColor(ColorStateList(arrayOf(intArrayOf(-android.R.attr.state_enabled), intArrayOf()), intArrayOf(mutedColor,
            if (primary) context.getColor(R.color.stor_on_primary) else inkColor)))
        button.backgroundTintList = null
        button.background = RippleDrawable(ColorStateList.valueOf(outlineColor), GradientDrawable().apply {
            cornerRadius = dp(16).toFloat(); setColor(if (primary) primaryColor else surfaceColor)
            if (!primary) setStroke(dp(1), outlineColor)
        }, null)
    }
    private fun button(value: String, action: () -> Unit) = Button(context).apply {
        text = value; textSize = 14f; typeface = font; fontVariationSettings = "'wght' 400"; includeFontPadding = false; minHeight = dp(48); minimumWidth = 0; minWidth = 0
        setPadding(dp(12), dp(8), dp(12), dp(8)); compoundDrawablePadding = dp(6)
        isAllCaps = false; styleButton(this, false); setOnClickListener { action() }
    }
    private fun row(buttons: List<Button>) = LinearLayout(context).apply {
        orientation = LinearLayout.HORIZONTAL
        buttons.forEachIndexed { index, button ->
            addView(button, LinearLayout.LayoutParams(0, -2, 1f).apply { if (index > 0) marginStart = dp(8) })
        }
    }
}
