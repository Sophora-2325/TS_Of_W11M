package com.stor.android.ocr

import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import ai.onnxruntime.TensorInfo
import android.content.Context
import android.graphics.Bitmap
import android.os.SystemClock
import org.locationtech.jts.geom.Coordinate
import org.locationtech.jts.geom.GeometryFactory
import org.opencv.android.OpenCVLoader
import org.opencv.android.Utils
import org.opencv.core.*
import org.opencv.imgproc.Imgproc
import java.io.Closeable
import java.nio.FloatBuffer
import java.security.MessageDigest
import kotlin.math.*

data class OcrResult(val text: String, val lineCount: Int, val elapsedMs: Long)

/** Full CPU pipeline. Calls and close are serialized on the service's OCR executor. */
class PaddleOcr private constructor(
    private val environment: OrtEnvironment,
    private val detection: OrtSession,
    private val recognition: OrtSession,
    private val dictionary: List<String>,
) : Closeable {
    companion object {
        fun open(context: Context): PaddleOcr {
            check(OpenCVLoader.initLocal()) { "OpenCV 初始化失败" }
            Core.setNumThreads(1)
            val directory = context.filesDir.resolve("models").apply { mkdirs() }
            val expected = mapOf(
                "det.onnx" to "d73e0058b7a8086bbd57f3d10b8bcd4ff95363f67e06e2762b5e814fe9c9410e",
                "rec.onnx" to "5435fd747c9e0efe15a96d0b378d5bd157e9492ed8fd80edf08f30d02fa24634",
                "ppocrv6_dict.txt" to "b5f2bfe2bdd9448429e3e82b51c789775d9b42f2403d082b00662eb77e401c5d",
            )
            // Validate packaged assets once at loading, before internal tensor operations.
            expected.forEach { (name, hash) ->
                val bytes = context.assets.open("models/$name").use { it.readBytes() }
                val digest = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
                check(digest == hash) { "模型文件校验失败：$name" }
                val file = directory.resolve(name)
                if (!file.exists()) file.writeBytes(bytes)
                // Load the checked bytes even if an earlier installation left a different file.
                else if (!file.readBytes().contentEquals(bytes)) file.writeBytes(bytes)
            }
            val dictionary = listOf("") + directory.resolve("ppocrv6_dict.txt").readLines() + listOf(" ")
            val environment = OrtEnvironment.getEnvironment()
            environment.setTelemetry(false)
            OrtSession.SessionOptions().use { options ->
                options.setIntraOpNumThreads(minOf(4, Runtime.getRuntime().availableProcessors()))
                options.setInterOpNumThreads(1)
                options.setCPUArenaAllocator(false)
                val detection = environment.createSession(directory.resolve("det.onnx").path, options)
                try {
                    val recognition = environment.createSession(directory.resolve("rec.onnx").path, options)
                    try {
                        val info = recognition.outputInfo.values.first().info as TensorInfo
                        check(info.shape.last().toInt() == dictionary.size) { "识别字典与模型输出不一致" }
                        return PaddleOcr(environment, detection, recognition, dictionary)
                    } catch (error: Exception) { recognition.close(); throw error }
                } catch (error: Exception) { detection.close(); throw error }
            }
        }
    }

    fun recognize(bitmap: Bitmap): OcrResult {
        val start = SystemClock.elapsedRealtime()
        val lines = Mat().useMat { rgba ->
            Utils.bitmapToMat(bitmap, rgba)
            Mat().useMat { bgr ->
                Imgproc.cvtColor(rgba, bgr, Imgproc.COLOR_RGBA2BGR)
                // Match desktop global resize and vertical padding before detection.
                val ratio = when {
                    maxOf(bgr.cols(), bgr.rows()) > 4096 -> 4096.0 / maxOf(bgr.cols(), bgr.rows())
                    minOf(bgr.cols(), bgr.rows()) < 30 -> 30.0 / minOf(bgr.cols(), bgr.rows())
                    else -> 1.0
                }
                if (ratio != 1.0) Imgproc.resize(bgr, bgr, Size(
                    maxOf(32.0, round(bgr.cols() * ratio / 32) * 32),
                    maxOf(32.0, round(bgr.rows() * ratio / 32) * 32)))
                val h = bgr.rows()
                val padding = if (h <= 30 || bgr.cols().toDouble() / h > 8) {
                    abs(maxOf(bgr.cols() / 8, 30) * 2 - h) / 2
                } else 0
                Mat().useMat { padded ->
                    Core.copyMakeBorder(bgr, padded, padding, padding, 0, 0, Core.BORDER_CONSTANT, Scalar.all(0.0))
                    val boxes = detect(padded).sortedWith(compareBy<Array<Point>> { it[0].y }.thenBy { it[0].x }).toMutableList()
                    // Desktop reading order: nearby top edges are ordered from left to right.
                    for (i in 1 until boxes.size) {
                        var j = i
                        while (j > 0 && abs(boxes[j][0].y - boxes[j - 1][0].y) < 10 && boxes[j][0].x < boxes[j - 1][0].x) {
                            val previous = boxes[j - 1]; boxes[j - 1] = boxes[j]; boxes[j] = previous; j--
                        }
                    }
                    boxes.map { points ->
                        crop(padded, points).useMat { recognizeLine(it) }
                    }.filter { it.confidence >= .5f && it.text.isNotBlank() }
                }
            }
        }
        return OcrResult(lines.joinToString("\n") { it.text.trim() }, lines.size, SystemClock.elapsedRealtime() - start)
    }

    private fun detect(image: Mat): List<Array<Point>> {
        val (width, height) = OcrMath.detectorSize(image.cols(), image.rows())
        val data = Mat().useMat { resized ->
            Imgproc.resize(image, resized, Size(width.toDouble(), height.toDouble()))
            val pixels = ByteArray(width * height * 3)
            resized.get(0, 0, pixels)
            FloatArray(pixels.size) { index ->
                val channel = index / (width * height)
                OcrMath.detectorValue(channel, pixels[(index % (width * height)) * 3 + channel].toInt() and 255)
            }
        }
        val probabilities = infer(detection, data, longArrayOf(1, 3, height.toLong(), width.toLong())).first
        return Mat(height, width, CvType.CV_32F).useMat { heatmap ->
            heatmap.put(0, 0, probabilities)
            Mat().useMat { bitmap ->
                Imgproc.threshold(heatmap, bitmap, .2, 255.0, Imgproc.THRESH_BINARY)
                bitmap.convertTo(bitmap, CvType.CV_8U)
                val contours = ArrayList<MatOfPoint>()
                Mat().useMat { hierarchy -> Imgproc.findContours(bitmap, contours, hierarchy, Imgproc.RETR_LIST, Imgproc.CHAIN_APPROX_SIMPLE) }
                try {
                    contours.take(3000).mapNotNull { contour ->
                        val rect = MatOfPoint2f(*contour.toArray()).useMat { Imgproc.minAreaRect(it) }
                        if (minOf(rect.size.width, rect.size.height) < 3) return@mapNotNull null
                        val points = arrayOf(Point(), Point(), Point(), Point())
                        rect.points(points)
                        if (boxScore(heatmap, points) < .45) return@mapNotNull null
                        val ordered = order(points)
                        val polygon = GeometryFactory().createPolygon((ordered + ordered.first()).map {
                            Coordinate(it.x.toInt().toDouble(), it.y.toInt().toDouble())
                        }.toTypedArray())
                        if (polygon.area == 0.0) return@mapNotNull null
                        val expanded = polygon.buffer(polygon.area * 1.4 / polygon.length)
                        val expandedRect = MatOfPoint2f(*expanded.coordinates.map { Point(it.x, it.y) }.toTypedArray())
                            .useMat { Imgproc.minAreaRect(it) }
                        if (minOf(expandedRect.size.width, expandedRect.size.height) < 5) return@mapNotNull null
                        val corners = arrayOf(Point(), Point(), Point(), Point())
                        expandedRect.points(corners)
                        val box = order(corners).map {
                            Point(round(it.x / width * image.cols()).coerceIn(0.0, image.cols() - 1.0),
                                round(it.y / height * image.rows()).coerceIn(0.0, image.rows() - 1.0))
                        }.toTypedArray()
                        if (distance(box[0], box[1]) <= 3 || distance(box[0], box[3]) <= 3) null else box
                    }
                } finally { contours.forEach { it.release() } }
            }
        }
    }

    private fun boxScore(heatmap: Mat, points: Array<Point>): Double {
        val left = floor(points.minOf { it.x }).toInt().coerceIn(0, heatmap.cols() - 1)
        val top = floor(points.minOf { it.y }).toInt().coerceIn(0, heatmap.rows() - 1)
        val right = ceil(points.maxOf { it.x }).toInt().coerceIn(0, heatmap.cols() - 1)
        val bottom = ceil(points.maxOf { it.y }).toInt().coerceIn(0, heatmap.rows() - 1)
        return Mat.zeros(bottom - top + 1, right - left + 1, CvType.CV_8U).useMat { mask ->
            MatOfPoint(*points.map { Point((it.x - left).toInt().toDouble(), (it.y - top).toInt().toDouble()) }.toTypedArray()).useMat {
                Imgproc.fillPoly(mask, listOf(it), Scalar.all(1.0))
            }
            heatmap.submat(top, bottom + 1, left, right + 1).useMat { Core.mean(it, mask).`val`[0] }
        }
    }

    private fun crop(image: Mat, points: Array<Point>): Mat {
        val width = maxOf(distance(points[0], points[1]), distance(points[2], points[3])).toInt()
        val height = maxOf(distance(points[0], points[3]), distance(points[1], points[2])).toInt()
        val result = Mat()
        MatOfPoint2f(*points).useMat { source ->
            MatOfPoint2f(Point(0.0, 0.0), Point(width.toDouble(), 0.0), Point(width.toDouble(), height.toDouble()), Point(0.0, height.toDouble())).useMat { target ->
                Imgproc.getPerspectiveTransform(source, target).useMat { transform ->
                    Imgproc.warpPerspective(image, result, transform, Size(width.toDouble(), height.toDouble()), Imgproc.INTER_CUBIC, Core.BORDER_REPLICATE)
                }
            }
        }
        if (height.toDouble() / width >= 1.5) Core.rotate(result, result, Core.ROTATE_90_COUNTERCLOCKWISE)
        return result
    }

    private fun recognizeLine(image: Mat): DecodedLine {
        val (resizedWidth, paddedWidth) = OcrMath.recognitionSize(image.cols(), image.rows())
        val usedWidth = minOf(resizedWidth, paddedWidth)
        val data = Mat().useMat { resized ->
            Imgproc.resize(image, resized, Size(usedWidth.toDouble(), 48.0))
            val pixels = ByteArray(usedWidth * 48 * 3)
            resized.get(0, 0, pixels)
            FloatArray(3 * 48 * paddedWidth).apply {
                for (channel in 0..2) for (y in 0 until 48) for (x in 0 until usedWidth) {
                    this[channel * 48 * paddedWidth + y * paddedWidth + x] =
                        ((pixels[(y * usedWidth + x) * 3 + channel].toInt() and 255) / 255f - .5f) / .5f
                }
            }
        }
        val (output, shape) = infer(recognition, data, longArrayOf(1, 3, 48, paddedWidth.toLong()))
        return OcrMath.decode(output, shape[1].toInt(), shape[2].toInt(), dictionary)
    }

    private fun infer(session: OrtSession, data: FloatArray, shape: LongArray): Pair<FloatArray, LongArray> {
        OnnxTensor.createTensor(environment, FloatBuffer.wrap(data), shape).use { input ->
            session.run(mapOf(session.inputNames.first() to input)).use { outputs ->
                val tensor = outputs[0] as OnnxTensor
                val buffer = tensor.floatBuffer
                return FloatArray(buffer.remaining()).also { buffer.get(it) } to tensor.info.shape
            }
        }
    }

    private fun order(points: Array<Point>): Array<Point> {
        val sorted = points.sortedBy { it.x }
        val left = sorted.take(2).sortedBy { it.y }
        val right = sorted.takeLast(2).sortedBy { it.y }
        return arrayOf(left[0], right[0], right[1], left[1])
    }
    private fun distance(a: Point, b: Point) = hypot(a.x - b.x, a.y - b.y)
    override fun close() { recognition.close(); detection.close() }
}

private inline fun <T : Mat, R> T.useMat(block: (T) -> R): R = try { block(this) } finally { release() }
