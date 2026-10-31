package com.stor.android

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.media.projection.MediaProjectionConfig
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.stor.android.ui.StorTheme
import com.stor.android.ui.StorIcon
import com.stor.android.capture.CaptureSessionService
import com.stor.android.translate.TranslationSettings
import com.stor.android.translate.TranslationSettingsScreen
import com.stor.android.translate.TranslationSettingsStore
import kotlinx.coroutines.CancellationException

class MainActivity : ComponentActivity() {
    companion object { const val OPEN_SETTINGS = "open_translation_settings" }
    private var settingsRequested by mutableStateOf(false)
    private var settingsFromOverlay = false
    private val capture = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        if (result.resultCode == Activity.RESULT_OK && result.data != null) {
            startForegroundService(Intent(this, CaptureSessionService::class.java).apply {
                action = CaptureSessionService.START
                putExtra("resultCode", result.resultCode)
                putExtra("data", result.data)
            })
        } else {
            SessionState.update(SessionPhase.STOPPED, "未开启截屏授权，可随时重试", false)
        }
    }
    private val notifications = registerForActivityResult(ActivityResultContracts.RequestPermission()) {
        requestCapture()
    }
    private val overlayPermission = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) {
        if (Settings.canDrawOverlays(this)) prepareCapture()
        else SessionState.update(SessionPhase.STOPPED, "需要允许悬浮窗，才能在其他应用中框选", false)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        settingsFromOverlay = savedInstanceState?.getBoolean("overlay_settings") ?: intent.getBooleanExtra(OPEN_SETTINGS, false)
        settingsRequested = savedInstanceState?.getBoolean("settings_visible") ?: settingsFromOverlay
        enableEdgeToEdge()
        setContent {
            val store = remember { TranslationSettingsStore(applicationContext) }
            var settings by remember { mutableStateOf(TranslationSettings()) }
            var settingsLoaded by remember { mutableStateOf(false) }
            var settingsError by remember { mutableStateOf<String?>(null) }
            LaunchedEffect(Unit) {
                try {
                    settings = store.read()
                    SessionState.defaultTargetLanguage = settings.targetLanguage
                } catch (cancelled: CancellationException) { throw cancelled }
                catch (_: Exception) { settingsError = "设置读取失败，请重新填写并保存翻译配置" }
                finally { settingsLoaded = true }
            }
            BackHandler(enabled = settingsRequested) { closeSettings() }
            StorTheme {
                val status by SessionState.status.collectAsStateWithLifecycle()
                val active = status.phase != SessionPhase.STOPPED
                Surface(Modifier.fillMaxSize()) {
                    if (settingsRequested) {
                        if (!settingsLoaded) {
                            Box(Modifier.fillMaxSize().safeDrawingPadding(), contentAlignment = androidx.compose.ui.Alignment.Center) { CircularProgressIndicator() }
                        } else TranslationSettingsScreen(settings, settingsError, { closeSettings() }) { updated ->
                            store.save(updated)
                            settings = updated
                            settingsError = null
                            SessionState.defaultTargetLanguage = updated.targetLanguage
                        }
                    } else {
                    var help by remember { mutableStateOf(false) }
                    val colors = MaterialTheme.colorScheme
                    Column(
                        Modifier.fillMaxSize().safeDrawingPadding().verticalScroll(rememberScrollState())
                            .padding(horizontal = 20.dp, vertical = 8.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp),
                    ) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                            Text(stringResource(R.string.app_name), style = MaterialTheme.typography.titleLarge)
                            IconButton(onClick = { settingsFromOverlay = false; settingsRequested = true }) {
                                StorIcon(R.drawable.ic_settings_2, "翻译设置")
                            }
                        }
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text("看懂眼前的文字", style = MaterialTheme.typography.displaySmall)
                            Text("留在当前应用，框选文字，即可识别与翻译。",
                                style = MaterialTheme.typography.bodyMedium, color = colors.onSurfaceVariant)
                        }
                        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            Surface(color = colors.surfaceVariant, shape = RoundedCornerShape(12.dp)) {
                                Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Text(if (active) "屏幕会话已开启" else "准备好，再开始", style = MaterialTheme.typography.titleMedium)
                                    Text(status.message, style = MaterialTheme.typography.bodyMedium, color = colors.onSurfaceVariant)
                                    if (active) Text(if (status.modelReady) "本地识别已就绪" else "正在准备本地识别…",
                                        style = MaterialTheme.typography.bodySmall, color = colors.primary)
                                }
                            }
                            Button(
                                onClick = {
                                    if (active) stopService(Intent(this@MainActivity, CaptureSessionService::class.java))
                                    else startSession()
                                },
                                modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp),
                                shape = RoundedCornerShape(16.dp), enabled = settingsLoaded,
                            ) { Text(if (active) "结束屏幕会话" else "开始屏幕翻译", style = MaterialTheme.typography.titleMedium) }
                            if (active) Text("切到其他应用即可使用侧边浮键。", style = MaterialTheme.typography.bodyMedium,
                                color = colors.onSurfaceVariant)
                            if (settings.baseUrl.isBlank()) Text("尚未配置翻译服务，可先使用本地识别。",
                                style = MaterialTheme.typography.bodyMedium, color = colors.onSurfaceVariant)
                            TextButton(onClick = { help = true }) {
                                StorIcon(R.drawable.ic_circle_help)
                                Spacer(Modifier.width(8.dp))
                                Text("使用说明")
                            }
                            Text("截图和识别仅在本机完成。\n点击翻译后，才将原文发送至所配置的服务。",
                                style = MaterialTheme.typography.bodySmall, color = colors.onSurfaceVariant)
                        }
                    }
                    if (help) AlertDialog(onDismissRequest = { help = false },
                        title = { Text("使用说明") },
                        text = { Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            Text("1. 开启屏幕翻译，切换到需要识别的应用。")
                            Text("2. 点击侧边浮键，框选文字并确认识别。")
                            Text("3. 检查或编辑原文，再点击翻译。")
                            Text("屏幕会话期间会显示系统提示，并可能增加耗电。结束会话后浮键移除；系统停止后重新开启需要授权。")
                        } },
                        confirmButton = { TextButton(onClick = { help = false }) { Text("知道了") } })
                    }
                }
            }
        }
    }

    private fun closeSettings() {
        settingsRequested = false
        if (settingsFromOverlay) finish()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        outState.putBoolean("overlay_settings", settingsFromOverlay)
        outState.putBoolean("settings_visible", settingsRequested)
        super.onSaveInstanceState(outState)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (intent.getBooleanExtra(OPEN_SETTINGS, false)) {
            settingsFromOverlay = true
            settingsRequested = true
        }
    }

    private fun startSession() {
        if (!Settings.canDrawOverlays(this)) {
            overlayPermission.launch(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName")))
        } else prepareCapture()
    }

    private fun prepareCapture() {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            notifications.launch(Manifest.permission.POST_NOTIFICATIONS)
        } else requestCapture()
    }

    private fun requestCapture() {
        val manager = getSystemService(MediaProjectionManager::class.java)
        val intent = if (Build.VERSION.SDK_INT >= 34) {
            manager.createScreenCaptureIntent(MediaProjectionConfig.createConfigForDefaultDisplay())
        } else manager.createScreenCaptureIntent()
        capture.launch(intent)
    }

    override fun onStart() { super.onStart(); SessionState.visibility(true) }
    override fun onStop() { SessionState.visibility(false); super.onStop() }
}
