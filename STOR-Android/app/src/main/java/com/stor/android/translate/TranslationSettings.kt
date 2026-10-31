package com.stor.android.translate

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withContext
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

private val Context.translationPreferences by preferencesDataStore("translation")

enum class TargetLanguage(val code: String, val label: String) {
    CHINESE("zh-CN", "简体中文"), ENGLISH("en", "English"), JAPANESE("ja", "日本語"),
}

data class TranslationConfig(val endpoint: HttpUrl, val model: String, val apiKey: String)

data class TranslationSettings(
    val baseUrl: String = "",
    val model: String = "",
    val apiKey: String = "",
    val targetLanguage: TargetLanguage = TargetLanguage.CHINESE,
) {
    /** External form/storage boundary. The request client receives only this validated type. */
    fun validated(): TranslationConfig {
        val url = baseUrl.trim().toHttpUrlOrNull()
        require(url != null && url.isHttps) { "请输入有效的 HTTPS 服务地址" }
        require(url.username.isEmpty() && url.password.isEmpty() && url.query == null && url.fragment == null) {
            "服务地址不能包含账号、密码、查询参数或片段"
        }
        require(model.isNotBlank()) { "请填写模型名称" }
        val key = apiKey.trim()
        require(key.isNotEmpty() && key.all { it.code in 33..126 }) { "请填写有效的 API Key，不能包含空格或换行" }
        val path = url.encodedPath.trimEnd('/')
        val endpoint = url.newBuilder().encodedPath(
            if (path.endsWith("/chat/completions")) path else "$path/chat/completions"
        ).build()
        return TranslationConfig(endpoint, model.trim(), key)
    }
}

class TranslationSettingsStore(context: Context) {
    private val store = context.applicationContext.translationPreferences
    private val addressKey = stringPreferencesKey("base_url")
    private val modelKey = stringPreferencesKey("model")
    private val languageKey = stringPreferencesKey("target_language")
    private val cipherKey = stringPreferencesKey("api_key_ciphertext")
    private val ivKey = stringPreferencesKey("api_key_iv")
    private val alias = "stor.translation.api-key"

    suspend fun read(): TranslationSettings = withContext(Dispatchers.IO) {
        val values = store.data.first()
        val encrypted = values[cipherKey]
        val apiKey = if (encrypted == null) "" else {
            val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
            val key = keyStore.getKey(alias, null) as? SecretKey
                ?: throw IllegalStateException("密钥无法读取，请重新填写 API Key 并保存")
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(128, Base64.decode(values[ivKey], Base64.NO_WRAP)))
            String(cipher.doFinal(Base64.decode(encrypted, Base64.NO_WRAP)), Charsets.UTF_8)
        }
        TranslationSettings(
            values[addressKey].orEmpty(), values[modelKey].orEmpty(), apiKey,
            TargetLanguage.entries.firstOrNull { it.code == values[languageKey] } ?: TargetLanguage.CHINESE,
        )
    }

    suspend fun readConfig(): TranslationConfig = read().validated()

    suspend fun save(settings: TranslationSettings) = withContext(Dispatchers.IO) {
        val config = settings.validated()
        val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        val key = keyStore.getKey(alias, null) as? SecretKey ?: KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore",
        ).apply {
            init(KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
        }.generateKey()
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key)
        val encrypted = cipher.doFinal(config.apiKey.toByteArray(Charsets.UTF_8))
        store.edit { values ->
            values[addressKey] = settings.baseUrl.trim()
            values[modelKey] = config.model
            values[languageKey] = settings.targetLanguage.code
            values[cipherKey] = Base64.encodeToString(encrypted, Base64.NO_WRAP)
            values[ivKey] = Base64.encodeToString(cipher.iv, Base64.NO_WRAP)
        }
    }
}
