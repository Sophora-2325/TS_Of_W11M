package com.stor.android.capture

import android.app.*
import android.content.Intent
import android.content.res.Configuration
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.*
import android.view.WindowManager
import android.util.LruCache
import com.stor.android.*
import com.stor.android.ocr.PaddleOcr
import com.stor.android.overlay.OverlayController
import com.stor.android.overlay.PixelCrop
import com.stor.android.overlay.ResultContent
import com.stor.android.overlay.ResultActions
import com.stor.android.translate.*
import kotlinx.coroutines.*
import java.util.concurrent.Executors

class CaptureSessionService : Service() {
    companion object {
        const val START = "com.stor.android.START"
        const val STOP = "com.stor.android.STOP"
        private const val CHANNEL = "screen_session"
    }
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val ocrExecutor = Executors.newSingleThreadExecutor()
    private val ocrDispatcher = ocrExecutor.asCoroutineDispatcher()
    private val handler = Handler(Looper.getMainLooper())
    private lateinit var overlay: OverlayController
    private lateinit var settings: TranslationSettingsStore
    private val translationClient = TranslationClient()
    private val translationCache = LruCache<TranslationInput, String>(20)
    private var translation: Job? = null
    private var resultContent: ResultContent? = null
    private var translationState = TranslationUiState()
    private var projection: MediaProjection? = null
    private var display: VirtualDisplay? = null
    private var reader: ImageReader? = null
    private var engine: PaddleOcr? = null
    private var modelReady = false
    private var frozen: Bitmap? = null
    private var capturePending = false
    private var captureAfterNanos = 0L
    private var operation: Job? = null
    private var width = 0
    private var height = 0
    private val captureTimeout = Runnable {
        capturePending = false
        returnToBubble("未取得新画面，请重试；部分页面可能不允许截图")
    }
    private val callback = object : MediaProjection.Callback() {
        override fun onStop() { stopSelf() }
        override fun onCapturedContentResize(width: Int, height: Int) {
            if (display != null && (width != this@CaptureSessionService.width || height != this@CaptureSessionService.height)) resize(width, height)
        }
    }

    override fun onCreate() {
        super.onCreate()
        overlay = OverlayController(this) { capture() }
        settings = TranslationSettingsStore(this)
        SessionState.onVisibilityChanged = { visible ->
            if (SessionState.status.value.phase == SessionPhase.READY) {
                if (visible) overlay.hide() else overlay.showBubble()
            } else if (SessionState.status.value.phase == SessionPhase.RESULT) {
                if (visible) overlay.hide() else renderResult()
            }
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == STOP) { stopSelf(); return START_NOT_STICKY }
        if (projection != null) return START_NOT_STICKY
        if (intent?.action != START) { stopSelf(); return START_NOT_STICKY }
        val consent = if (Build.VERSION.SDK_INT >= 33) intent.getParcelableExtra("data", Intent::class.java)
            else @Suppress("DEPRECATION") intent.getParcelableExtra<Intent>("data")
        val resultCode = intent.getIntExtra("resultCode", Activity.RESULT_CANCELED)
        if (consent == null || resultCode != Activity.RESULT_OK) { stopSelf(); return START_NOT_STICKY }
        try {
            if (Build.VERSION.SDK_INT >= 29) {
                startForeground(1, notification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION)
            } else startForeground(1, notification())
            SessionState.update(SessionPhase.STARTING, "正在建立屏幕会话", false)
            projection = getSystemService(MediaProjectionManager::class.java).getMediaProjection(resultCode, consent)
            projection!!.registerCallback(callback, handler)
            val size = displaySize()
            width = size.first; height = size.second
            reader = newReader(width, height)
            display = projection!!.createVirtualDisplay("STOR", width, height, resources.displayMetrics.densityDpi,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR, reader!!.surface, null, handler)
            returnToBubble("屏幕会话已开启，正在准备本地识别")
            scope.launch {
                try {
                    withContext(ocrDispatcher) { engine = PaddleOcr.open(this@CaptureSessionService) }
                    modelReady = true
                    val state = SessionState.status.value
                    SessionState.update(state.phase, if (state.phase == SessionPhase.READY) "切到目标应用，点击侧边按钮开始框选" else state.message, true)
                } catch (cancelled: CancellationException) { throw cancelled }
                catch (error: Exception) {
                    SessionState.update(SessionPhase.STOPPED, "本地识别准备失败，请重新开启会话；仍失败可重新安装", false)
                    stopSelf()
                }
            }
        } catch (error: SecurityException) {
            SessionState.update(SessionPhase.STOPPED, "屏幕授权已失效，请重新开启", false)
            stopSelf()
        }
        return START_NOT_STICKY
    }

    private fun newReader(w: Int, h: Int) = ImageReader.newInstance(w, h, PixelFormat.RGBA_8888, 2).apply {
        setOnImageAvailableListener({ source ->
            source.acquireLatestImage()?.use { image ->
                if (!capturePending || image.timestamp <= captureAfterNanos) return@use
                capturePending = false
                handler.removeCallbacks(captureTimeout)
                val plane = image.planes[0]
                val paddedWidth = image.width + (plane.rowStride - plane.pixelStride * image.width) / plane.pixelStride
                val padded = Bitmap.createBitmap(paddedWidth, image.height, Bitmap.Config.ARGB_8888)
                padded.copyPixelsFromBuffer(plane.buffer)
                frozen = Bitmap.createBitmap(padded, 0, 0, image.width, image.height)
                android.util.Log.i("STOR_CAPTURE", "newFrameAgeMs=${(image.timestamp - captureAfterNanos) / 1_000_000.0}")
                if (padded !== frozen) padded.recycle()
                showSelection()
            }
        }, handler)
    }

    private fun capture() {
        if (!modelReady) {
            android.widget.Toast.makeText(this, "本地识别正在准备，请稍候", android.widget.Toast.LENGTH_SHORT).show()
            return
        }
        operation?.cancel()
        discardResult()
        overlay.hide()
        frozen = null
        SessionState.update(SessionPhase.CAPTURING, "正在截取当前画面")
        reader?.acquireLatestImage()?.close()
        // Surface remains connected. Reject queued frames composed before synchronous removal.
        captureAfterNanos = System.nanoTime()
        capturePending = true
        handler.postDelayed(captureTimeout, 2000)
    }

    private fun showSelection() {
        val image = frozen ?: return
        discardResult()
        SessionState.update(SessionPhase.SELECTING, "框选后点击识别")
        overlay.showSelection(image, { returnToBubble() }) { crop -> recognize(image, crop) }
    }

    private fun recognize(image: Bitmap, crop: PixelCrop) {
        SessionState.update(SessionPhase.RECOGNIZING, "正在本地识别")
        overlay.showBusy("正在识别选区…") { operation?.cancel(); returnToBubble() }
        operation = scope.launch {
            try {
                val result = withContext(ocrDispatcher) {
                    val clipped = Bitmap.createBitmap(image, crop.left, crop.top, crop.width, crop.height)
                    try { engine!!.recognize(clipped) } finally { if (clipped !== image) clipped.recycle() }
                }
                SessionState.update(SessionPhase.RESULT, "识别完成，可修改或复制原文")
                val detail = if (result.text.isBlank()) "未找到文字，可调整选区或手动输入" else "${result.lineCount} 行 · 本地识别 ${result.elapsedMs} ms · 可编辑"
                showResult(result.text, detail)
            } catch (cancelled: CancellationException) { throw cancelled }
            catch (error: Exception) {
                SessionState.update(SessionPhase.RESULT, "识别失败，可调整选区或重新截图")
                showResult("", "识别失败，请调整选区重试，或手动输入原文")
            }
        }
    }

    private fun showResult(text: String, detail: String) {
        resultContent = ResultContent(text, detail, SessionState.defaultTargetLanguage)
        translationState = TranslationUiState()
        renderResult()
    }

    private fun renderResult() {
        val content = resultContent ?: return
        overlay.showResult(content, translationState, ResultActions(
            inputChanged = { source, language ->
                val previous = resultContent
                if (previous != null && (source != previous.source || language != previous.language)) {
                    translation?.cancel()
                    translation = null
                    resultContent = previous.copy(source = source, language = language)
                    setTranslation(TranslationUiState())
                }
            },
            translate = { translate() },
            cancelTranslation = { cancelTranslation() },
            settings = {
                cancelTranslation()
                // Keep the visible overlay until Activity.onStart; Android 15+ requires
                // it for this user-triggered background Activity launch.
                startActivity(Intent(this, MainActivity::class.java).putExtra(MainActivity.OPEN_SETTINGS, true)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP))
            },
            adjust = { showSelection() }, capture = { capture() }, dismiss = { returnToBubble() },
        ), width, height)
    }

    private fun translate() {
        val content = resultContent ?: return
        if (content.source.isBlank()) return
        translation?.cancel()
        setTranslation(TranslationUiState(message = "正在连接翻译服务…", running = true))
        translation = scope.launch {
            val output = StringBuilder()
            try {
                val config = settings.readConfig()
                val input = TranslationInput(config, content.source, content.language)
                val cached = translationCache.get(input)
                if (cached != null) {
                    setTranslation(TranslationUiState(cached, "已使用本次会话缓存"))
                    return@launch
                }
                translationClient.stream(input).collect { piece ->
                    output.append(piece)
                    setTranslation(TranslationUiState(output.toString(), "正在翻译…", running = true))
                }
                val text = output.toString()
                translationCache.put(input, text)
                setTranslation(TranslationUiState(text, "翻译完成"))
            } catch (cancelled: CancellationException) { throw cancelled }
            catch (invalid: IllegalArgumentException) {
                setTranslation(TranslationUiState(output.toString(), invalid.message ?: "请先填写翻译设置", retry = true))
            } catch (failure: TranslationFailure) {
                setTranslation(TranslationUiState(output.toString(), failure.message ?: "翻译失败，请手动重试", retry = true))
            } catch (_: Exception) {
                setTranslation(TranslationUiState(output.toString(), "无法读取翻译配置或连接服务，请检查设置后重试", retry = true))
            }
        }
    }

    private fun setTranslation(state: TranslationUiState) {
        translationState = state
        overlay.updateTranslation(state)
    }

    private fun cancelTranslation() {
        if (translationState.running) {
            translation?.cancel()
            translation = null
            setTranslation(translationState.copy(message = "已取消，可手动重试；服务可能已计费", running = false, retry = true))
        }
    }

    private fun discardResult() {
        translation?.cancel()
        translation = null
        resultContent = null
        translationState = TranslationUiState()
    }

    private fun returnToBubble(message: String = "点击侧边按钮可再次截图") {
        discardResult()
        capturePending = false
        handler.removeCallbacks(captureTimeout)
        frozen = null
        SessionState.update(SessionPhase.READY, message, modelReady)
        if (SessionState.appVisible) overlay.hide() else overlay.showBubble()
    }

    private fun resize(w: Int, h: Int) {
        operation?.cancel()
        // An editable text result is independent of display pixels. Keep it when
        // switching from a landscape app to portrait settings and back.
        val keepResult = SessionState.status.value.phase == SessionPhase.RESULT
        if (keepResult) overlay.hide() else returnToBubble("画面尺寸已变化，请重新截图")
        width = w; height = h
        val previous = reader
        reader = newReader(w, h)
        display?.resize(w, h, resources.displayMetrics.densityDpi)
        display?.surface = reader!!.surface
        previous?.close()
        if (keepResult && !SessionState.appVisible) renderResult()
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        val size = displaySize()
        if (display != null && (size.first != width || size.second != height)) resize(size.first, size.second)
    }

    private fun displaySize(): Pair<Int, Int> {
        val manager = getSystemService(WindowManager::class.java)
        if (Build.VERSION.SDK_INT >= 30) return manager.maximumWindowMetrics.bounds.let { it.width() to it.height() }
        val metrics = android.util.DisplayMetrics()
        @Suppress("DEPRECATION") manager.defaultDisplay.getRealMetrics(metrics)
        return metrics.widthPixels to metrics.heightPixels
    }

    private fun notification(): Notification {
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(NotificationChannel(CHANNEL, "屏幕翻译会话", NotificationManager.IMPORTANCE_LOW))
        val home = PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE)
        val stop = PendingIntent.getService(this, 1, Intent(this, CaptureSessionService::class.java).setAction(STOP), PendingIntent.FLAG_IMMUTABLE)
        return Notification.Builder(this, CHANNEL).setSmallIcon(R.drawable.ic_stor)
            .setContentTitle(getString(R.string.capture_notification_title)).setContentText("点击侧边按钮截图框选；可随时结束会话")
            .setContentIntent(home).setOngoing(true).addAction(Notification.Action.Builder(null, "结束会话", stop).build()).build()
    }

    override fun onDestroy() {
        SessionState.onVisibilityChanged = null
        handler.removeCallbacksAndMessages(null)
        overlay.hide()
        projection?.unregisterCallback(callback)
        display?.release(); reader?.close(); projection?.stop()
        scope.cancel()
        translationCache.evictAll()
        // TLS socket close can write to the network. Clean up off the main thread,
        // after any in-flight JNI call; coroutine cancellation does not interrupt JNI.
        ocrExecutor.execute { translationClient.close(); engine?.close(); ocrExecutor.shutdown() }
        frozen = null
        val status = SessionState.status.value
        val message = if (status.phase == SessionPhase.STOPPED) status.message else "屏幕会话已结束，重新开启需要授权"
        SessionState.update(SessionPhase.STOPPED, message, false)
        super.onDestroy()
    }
    override fun onBind(intent: Intent?) = null
}
