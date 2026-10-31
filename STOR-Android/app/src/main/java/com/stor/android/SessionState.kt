package com.stor.android

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import com.stor.android.translate.TargetLanguage

enum class SessionPhase { STOPPED, STARTING, READY, CAPTURING, SELECTING, RECOGNIZING, RESULT }

data class SessionStatus(
    val phase: SessionPhase = SessionPhase.STOPPED,
    val message: String = "尚未开启屏幕翻译",
    val modelReady: Boolean = false,
)

/** One in-process session; the foreground service owns all capture/OCR resources. */
object SessionState {
    var defaultTargetLanguage = TargetLanguage.CHINESE
    private val mutable = MutableStateFlow(SessionStatus())
    val status = mutable.asStateFlow()
    var appVisible = false
        private set
    var onVisibilityChanged: ((Boolean) -> Unit)? = null

    fun visibility(visible: Boolean) {
        appVisible = visible
        onVisibilityChanged?.invoke(visible)
    }

    fun update(phase: SessionPhase, message: String, modelReady: Boolean = mutable.value.modelReady) {
        mutable.value = SessionStatus(phase, message, modelReady)
    }
}
