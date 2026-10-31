package com.stor.android.translate

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import com.stor.android.R
import com.stor.android.ui.StorIcon
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

@Composable
fun TranslationSettingsScreen(initial: TranslationSettings, loadError: String?, onBack: () -> Unit, onSave: suspend (TranslationSettings) -> Unit) {
    var address by remember { mutableStateOf(initial.baseUrl) }
    var model by remember { mutableStateOf(initial.model) }
    // Secrets stay in ordinary memory, never in a saved-instance-state Bundle.
    var apiKey by remember { mutableStateOf(initial.apiKey) }
    var language by remember { mutableStateOf(initial.targetLanguage) }
    var revealKey by remember { mutableStateOf(false) }
    var saving by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf(loadError) }
    var saved by remember { mutableStateOf(false) }
    var help by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
        Column(Modifier.widthIn(max = 600.dp).fillMaxSize().safeDrawingPadding().imePadding().padding(horizontal = 20.dp)) {
            Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack, enabled = !saving) { StorIcon(R.drawable.ic_arrow_left, "返回") }
                Text("翻译设置", style = MaterialTheme.typography.titleLarge, modifier = Modifier.weight(1f))
                IconButton(onClick = { help = true }) { StorIcon(R.drawable.ic_circle_help, "设置帮助") }
            }
            // Natural form height when it fits; scrolling only consumes the available remainder.
            Column(Modifier.weight(1f, fill = false).verticalScroll(rememberScrollState()).padding(top = 8.dp, bottom = 16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)) {
                val fieldColors = OutlinedTextFieldDefaults.colors(
                    unfocusedContainerColor = MaterialTheme.colorScheme.surfaceVariant,
                    focusedContainerColor = MaterialTheme.colorScheme.surfaceVariant,
                )
                OutlinedTextField(address, { address = it; saved = false }, Modifier.fillMaxWidth().heightIn(min = 56.dp), enabled = !saving,
                    label = { Text("服务地址") }, placeholder = { Text("https://example.com/v1") },
                    shape = RoundedCornerShape(12.dp), colors = fieldColors,
                    singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri, autoCorrectEnabled = false))
                OutlinedTextField(model, { model = it; saved = false }, Modifier.fillMaxWidth().heightIn(min = 56.dp), enabled = !saving,
                    label = { Text("模型名称") }, singleLine = true, shape = RoundedCornerShape(12.dp), colors = fieldColors,
                    keyboardOptions = KeyboardOptions(autoCorrectEnabled = false))
                OutlinedTextField(apiKey, { apiKey = it; saved = false }, Modifier.fillMaxWidth().heightIn(min = 56.dp), enabled = !saving,
                    label = { Text("API Key") }, singleLine = true, shape = RoundedCornerShape(12.dp), colors = fieldColors,
                    visualTransformation = if (revealKey) VisualTransformation.None else PasswordVisualTransformation(),
                    trailingIcon = { IconButton(onClick = { revealKey = !revealKey }) {
                        StorIcon(if (revealKey) R.drawable.ic_eye_off else R.drawable.ic_eye, if (revealKey) "隐藏 API Key" else "显示 API Key")
                    } }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, autoCorrectEnabled = false))
                Text("密钥在本机加密保存，不写入日志。", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text("默认目标语言", style = MaterialTheme.typography.titleSmall)
                SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth().height(IntrinsicSize.Min)) {
                    TargetLanguage.entries.forEachIndexed { index, option ->
                        SegmentedButton(selected = language == option, onClick = { language = option; saved = false },
                            enabled = !saving, shape = SegmentedButtonDefaults.itemShape(index, TargetLanguage.entries.size),
                            colors = SegmentedButtonDefaults.colors(
                                activeContainerColor = MaterialTheme.colorScheme.primary,
                                activeContentColor = MaterialTheme.colorScheme.onPrimary,
                                inactiveContainerColor = MaterialTheme.colorScheme.surfaceVariant,
                                inactiveContentColor = MaterialTheme.colorScheme.onSurfaceVariant,
                            ),
                            icon = {}, modifier = Modifier.fillMaxHeight().heightIn(min = 48.dp)) {
                            Text(option.label, style = MaterialTheme.typography.labelLarge)
                        }
                    }
                }
                error?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium) }
                if (saved) Text("设置已保存", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.bodyMedium)
            }
            Button(enabled = !saving, onClick = {
                saving = true; saved = false; error = null
                scope.launch {
                    try {
                        onSave(TranslationSettings(address, model, apiKey, language))
                        saved = true
                    } catch (cancelled: CancellationException) { throw cancelled }
                    catch (invalid: IllegalArgumentException) { error = invalid.message ?: "请检查填写的设置" }
                    catch (_: Exception) { error = "设置保存失败，请重新填写 API Key 后重试" }
                    finally { saving = false }
                }
            }, modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp).heightIn(min = 56.dp), shape = RoundedCornerShape(16.dp)) {
                Text(if (saving) "正在保存…" else "保存设置", style = MaterialTheme.typography.titleMedium)
            }
        }
    }
    if (help) AlertDialog(onDismissRequest = { help = false }, title = { Text("配置翻译服务") },
        text = { Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("使用兼容 Chat Completions 的 HTTPS 服务。填写 /v1 基础地址或完整 /chat/completions 地址，并使用服务商提供的模型标识。")
            Text("截图和识别留在手机内，只有点击翻译后的原文会发送给该服务。")
            Text("请求不会自动重试。断网、额度不足或取消后，原文和已收到的译文会保留，由你决定是否再次请求。")
        } }, confirmButton = { TextButton(onClick = { help = false }) { Text("知道了") } })
}
