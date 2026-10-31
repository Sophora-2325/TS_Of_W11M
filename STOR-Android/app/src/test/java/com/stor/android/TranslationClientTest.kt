package com.stor.android

import com.stor.android.translate.*
import java.io.Closeable
import java.net.ServerSocket
import java.net.Socket
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import kotlin.concurrent.thread
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.collect
import okhttp3.HttpUrl.Companion.toHttpUrl
import org.junit.Assert.*
import org.junit.Test

/** Exercises the actual OkHttp reader against loopback; no external service or credentials. */
class TranslationClientTest {
    private class Endpoint(val respond: (Socket) -> Unit) : Closeable {
        val server = ServerSocket(0)
        val count = AtomicInteger()
        @Volatile var request = ""
        val worker = thread(isDaemon = true) {
            try {
                server.accept().use { socket ->
                    socket.soTimeout = 4000
                    val input = socket.getInputStream()
                    val headers = mutableListOf<String>()
                    while (true) {
                        val lineBytes = java.io.ByteArrayOutputStream()
                        while (true) { val value = input.read(); if (value < 0 || value == 10) break; if (value != 13) lineBytes.write(value) }
                        val line = lineBytes.toString("UTF-8")
                        if (line.isEmpty()) break
                        headers += line
                    }
                    val length = headers.first { it.startsWith("Content-Length:", true) }.substringAfter(':').trim().toInt()
                    val body = ByteArray(length)
                    var read = 0
                    while (read < length) { val n = input.read(body, read, length - read); if (n < 0) break; read += n }
                    request = headers.joinToString("\n") + "\n" + String(body, 0, read, Charsets.UTF_8)
                    count.incrementAndGet()
                    respond(socket)
                }
            } catch (_: java.io.IOException) { /* Close releases accept after failed assertions. */ }
        }
        val config get() = TranslationConfig("http://127.0.0.1:${server.localPort}/v1/chat/completions".toHttpUrl(), "test-model", "synthetic-test-key")
        override fun close() { server.close(); worker.join(4500) }
    }

    private fun reply(socket: Socket, body: String, type: String = "text/event-stream", status: Int = 200, fragment: Boolean = false) {
        val bytes = body.toByteArray(Charsets.UTF_8)
        val output = socket.getOutputStream()
        output.write("HTTP/1.1 $status Test\r\nContent-Type: $type\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray())
        if (fragment) bytes.forEach { output.write(it.toInt()); output.flush(); if (it.toInt() < 0) Thread.sleep(1) }
        else { output.write(bytes); output.flush() }
    }

    private fun delta(text: String) = "data: {\"choices\":[{\"index\":0,\"delta\":{\"content\":\"$text\"}}]}\r\n\r\n"
    private fun finish(reason: String = "stop") = "data: {\"choices\":[{\"index\":0,\"delta\":{},\"finish_reason\":\"$reason\"}]}\r\n\r\n"
    private fun collect(endpoint: Endpoint): Pair<String, Throwable?> = runBlocking {
        val output = StringBuilder()
        val failure = TranslationClient().use { client ->
            runCatching { withTimeout(6000) { client.stream(TranslationInput(endpoint.config, "source", TargetLanguage.CHINESE)).collect { output.append(it) } } }.exceptionOrNull()
        }
        output.toString() to failure
    }

    @Test fun settingsValidateOnceAndNormalizeEndpoint() {
        assertEquals("https://example.com/v1/chat/completions", TranslationSettings(" https://example.com/v1/ ", " m ", " key ").validated().endpoint.toString())
        assertEquals("https://example.com/v1/chat/completions", TranslationSettings("https://example.com/v1/chat/completions", "m", "key").validated().endpoint.toString())
        listOf("http://example.com/v1", "https://user:pass@example.com/v1", "https://example.com/v1?q=x", "https://example.com/v1#x").forEach {
            assertTrue(runCatching { TranslationSettings(it, "m", "key").validated() }.exceptionOrNull() is IllegalArgumentException)
        }
        assertTrue(runCatching { TranslationSettings("https://example.com/v1", "m", "bad\nkey").validated() }.isFailure)
    }

    @Test fun fragmentedUtf8AndStopCompleteWithoutDone() {
        Endpoint { reply(it, ": heartbeat\r\n\r\n" + delta("中文") + delta("日本語") + finish(), fragment = true) }.use { endpoint ->
            val result = collect(endpoint)
            assertNull(result.second); assertEquals("中文日本語", result.first)
            assertEquals(1, endpoint.count.get())
            assertTrue(endpoint.request.contains("Authorization: Bearer synthetic-test-key"))
            assertTrue(endpoint.request.contains("\"stream\":true"))
        }
    }

    @Test fun doneAndJsonResponsesComplete() {
        Endpoint { reply(it, delta("译文") + "data: [DONE]\n\n") }.use { assertEquals("译文" to null, collect(it)) }
        Endpoint { reply(it, """{"choices":[{"index":0,"message":{"content":"JSON译文"},"finish_reason":"stop"}]}""", "application/json") }.use {
            assertEquals("JSON译文" to null, collect(it))
        }
    }

    @Test fun earlyEofAndLengthPreservePartialButFail() {
        listOf("" to "提前结束", finish("length") to "长度上限").forEach { (ending, message) ->
            Endpoint { reply(it, delta("部分译文") + ending) }.use {
                val result = collect(it)
                assertEquals("部分译文", result.first)
                assertTrue(result.second is TranslationFailure)
                assertTrue(result.second!!.message!!.contains(message))
            }
        }
    }

    @Test fun emptyMalformedAndProviderErrorFail() {
        listOf(finish(), "data: nonsense\n\n", "data: {\"error\":{\"message\":\"private-error\"}}\n\n", delta("   ") + finish()).forEach { response ->
            Endpoint { reply(it, response) }.use {
                val result = collect(it)
                assertTrue(result.second is TranslationFailure)
                assertFalse(result.second!!.message!!.contains("private-error"))
            }
        }
    }

    @Test fun httpFailuresAreSafeAndNeverRetried() {
        listOf(401, 403, 429, 500, 503, 302).forEach { status ->
            Endpoint { reply(it, "private-error", "application/json", status) }.use {
                val result = collect(it)
                assertTrue(result.second is TranslationFailure)
                assertFalse(result.second!!.message!!.contains("private-error"))
                assertEquals(1, it.count.get())
            }
        }
    }

    @Test fun cancellationClosesSocketAndDoesNotRetry() = runBlocking {
        val disconnected = CountDownLatch(1)
        Endpoint { socket ->
            val output = socket.getOutputStream()
            output.write("HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nTransfer-Encoding: chunked\r\n\r\n".toByteArray())
            val chunk = delta("开始").toByteArray()
            output.write("${chunk.size.toString(16)}\r\n".toByteArray()); output.write(chunk); output.write("\r\n".toByteArray()); output.flush()
            if (socket.getInputStream().read() == -1) disconnected.countDown()
        }.use { endpoint ->
            TranslationClient().use { client ->
                val first = CompletableDeferred<Unit>()
                val job = launch { client.stream(TranslationInput(endpoint.config, "source", TargetLanguage.JAPANESE)).collect { first.complete(Unit) } }
                withTimeout(6000) { first.await() }
                job.cancelAndJoin()
                assertTrue("cancel must close the active network read", disconnected.await(3, TimeUnit.SECONDS))
                assertEquals(1, endpoint.count.get())
            }
        }
    }
}
