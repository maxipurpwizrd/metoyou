package expo.modules.cliprenderer

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Handler
import android.os.Looper
import androidx.media3.common.Effects
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.util.UnstableApi
import androidx.media3.effect.BitmapOverlay
import androidx.media3.effect.OverlayEffect
import androidx.media3.effect.Presentation
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.ProgressHolder
import androidx.media3.transformer.Transformer
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.launch
import java.io.File
import java.util.UUID
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

@androidx.annotation.OptIn(UnstableApi::class)
class ClipRendererModule : Module() {
  private val mainHandler = Handler(Looper.getMainLooper())
  private val activeJobs = mutableMapOf<String, ExportJob>()

  override fun definition() = ModuleDefinition {
    Name("MeToYouClipRenderer")
    Events("onExportProgress")

    AsyncFunction("render") { options: Map<String, Any?>, promise: Promise ->
      val request = try {
        parseRequest(options)
      } catch (error: IllegalArgumentException) {
        promise.reject("ERR_CLIP_RENDER_INVALID_INPUT", error.message, error)
        return@AsyncFunction
      }

      val prepared = try {
        prepareExport(request)
      } catch (error: Exception) {
        promise.reject("ERR_CLIP_RENDER_PREPARE", error.message, error)
        return@AsyncFunction
      }

      appContext.mainQueue.launch {
        try {
          startExport(prepared, promise)
        } catch (error: Exception) {
          if (!prepared.overlayBitmap.isRecycled) prepared.overlayBitmap.recycle()
          prepared.outputFile.delete()
          promise.reject("ERR_CLIP_RENDER_START", error.message, error)
        }
      }
    }

    AsyncFunction("cancel") { jobId: String, promise: Promise ->
      val job = activeJobs.remove(jobId)
      if (job == null) {
        promise.resolve()
      } else {
        job.progressHandler?.let(mainHandler::removeCallbacks)
        job.transformer.cancel()
        job.outputFile.delete()
        job.overlayBitmap.recycle()
        job.promise.reject("ERR_CLIP_RENDER_CANCELLED", "Video rendering was cancelled.", null)
        promise.resolve()
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("deleteOutput") { uriString: String, promise: Promise ->
      try {
        val uri = Uri.parse(uriString)
        require(uri.scheme == "file") { "Only renderer output files can be deleted." }
        val outputFile = File(requireNotNull(uri.path)).canonicalFile
        val cacheDirectory = appContext.cacheDirectory.canonicalFile
        require(
          outputFile.parentFile == cacheDirectory &&
            outputFile.name.startsWith(OUTPUT_FILE_PREFIX) &&
            outputFile.extension == "mp4"
        ) { "Only renderer output files can be deleted." }
        if (outputFile.exists() && !outputFile.delete()) {
          throw IllegalStateException("Could not delete the temporary rendered video.")
        }
        promise.resolve()
      } catch (error: Exception) {
        promise.reject("ERR_CLIP_RENDER_DELETE", error.message, error)
      }
    }
  }

  private fun parseRequest(options: Map<String, Any?>): RenderRequest {
    val sourceUri = options.requiredString("sourceUri")
    val uri = Uri.parse(sourceUri)
    require(uri.scheme == "file" || uri.scheme == "content") {
      "Select local media from the device gallery."
    }
    val sourceType = options.requiredString("sourceType")
    require(sourceType == "image" || sourceType == "video") {
      "Source type must be image or video."
    }

    val startMs = options.requiredLong("trimStartMs")
    val endMs = options.requiredLong("trimEndMs")
    require(startMs >= 0L && endMs > startMs) {
      "Trim end must be greater than trim start, and trim start cannot be negative."
    }
    require(endMs - startMs <= MAX_CLIP_DURATION_MS) {
      "The rendered segment cannot exceed 20 seconds."
    }

    val text = options.requiredString("text").trim()
    require(text.length <= MAX_OVERLAY_CHARACTERS) {
      "Overlay text cannot exceed $MAX_OVERLAY_CHARACTERS characters."
    }
    require(text.count { it == '\n' } <= MAX_OVERLAY_LINES - 1) {
      "Overlay text can contain at most $MAX_OVERLAY_LINES lines."
    }

    val x = options.requiredNumber("x").toFloat()
    val y = options.requiredNumber("y").toFloat()
    require(x in 0f..1f && y in 0f..1f) { "Overlay position must be between 0 and 1." }

    val textColor = parseColor(options.requiredString("textColor"), "Text color")
    val backgroundColor = when (val value = options["backgroundColor"]) {
      null -> null
      is String -> value.takeIf(String::isNotBlank)?.let { parseColor(it, "Background color") }
      else -> throw IllegalArgumentException("Background color must be a string.")
    }
    val jobId = options.requiredString("jobId")
    require(jobId.isNotBlank()) { "Missing or invalid jobId." }

    return RenderRequest(
      jobId = jobId,
      sourceUri = uri,
      sourceType = sourceType,
      startMs = startMs,
      endMs = endMs,
      text = text,
      textColor = textColor,
      backgroundColor = backgroundColor,
      x = x,
      y = y
    )
  }

  private fun prepareExport(request: RenderRequest): PreparedExport {
    val inputInfo = if (request.sourceType == "image") {
      readImageInfo(request.sourceUri)
    } else {
      readInputInfo(request.sourceUri)
    }
    val endMs = min(request.endMs, inputInfo.durationMs)
    require(endMs > request.startMs) {
      "The selected media must be longer than the requested trim start."
    }
    val exportRequest = request.copy(endMs = endMs)

    val (outputWidth, outputHeight) = getOutputSize(inputInfo.width, inputInfo.height)
    val overlayBitmap = createOverlayBitmap(
      width = outputWidth,
      height = outputHeight,
      text = exportRequest.text,
      textColor = exportRequest.textColor,
      backgroundColor = exportRequest.backgroundColor,
      x = exportRequest.x,
      y = exportRequest.y
    )
    val outputFile = File(
      appContext.cacheDirectory,
      "$OUTPUT_FILE_PREFIX${UUID.randomUUID()}.mp4"
    )
    return PreparedExport(exportRequest, outputWidth, outputHeight, overlayBitmap, outputFile)
  }

  private fun startExport(prepared: PreparedExport, promise: Promise) {
    require(activeJobs.isEmpty()) { "Another video is already rendering." }
    val request = prepared.request
    val overlayBitmap = prepared.overlayBitmap
    val outputFile = prepared.outputFile
    val clipping = MediaItem.ClippingConfiguration.Builder()
      .setStartPositionMs(request.startMs)
      .setEndPositionMs(request.endMs)
      .build()
    val mediaItemBuilder = MediaItem.Builder().setUri(request.sourceUri)
    if (request.sourceType == "image") {
      mediaItemBuilder.setImageDurationMs(request.endMs - request.startMs)
    } else {
      mediaItemBuilder.setClippingConfiguration(clipping)
    }
    val mediaItem = mediaItemBuilder.build()
    val editedMediaItem = EditedMediaItem.Builder(mediaItem)
      .setEffects(
        Effects(
          emptyList(),
          listOf(
            Presentation.createForWidthAndHeight(
              prepared.outputWidth,
              prepared.outputHeight,
              Presentation.LAYOUT_SCALE_TO_FIT
            ),
            OverlayEffect(listOf(BitmapOverlay.createStaticBitmapOverlay(overlayBitmap)))
          )
        )
      )
      .build()

    var job: ExportJob? = null
    val listener = object : Transformer.Listener {
      override fun onCompleted(composition: androidx.media3.transformer.Composition, exportResult: ExportResult) {
        job?.let(::finishSuccess)
      }

      override fun onError(
        composition: androidx.media3.transformer.Composition,
        exportResult: ExportResult,
        exportException: ExportException
      ) {
        job?.let { finishFailure(it, "ERR_CLIP_RENDER_EXPORT", exportException) }
      }
    }

    try {
      val transformer = Transformer.Builder(
        requireNotNull(appContext.reactContext) { "The React Native context is not available." }
      )
        .setLooper(Looper.getMainLooper())
        .setVideoMimeType(MimeTypes.VIDEO_H264)
        .setAudioMimeType(MimeTypes.AUDIO_AAC)
        .setEnsureFileStartsOnVideoFrameEnabled(true)
        .addListener(listener)
        .build()
      val exportJob = ExportJob(request.jobId, transformer, outputFile, promise, overlayBitmap)
      job = exportJob
      activeJobs[request.jobId] = exportJob
      sendEvent("onExportProgress", mapOf("jobId" to request.jobId, "progress" to 0))
      scheduleProgress(exportJob)
      transformer.start(editedMediaItem, outputFile.absolutePath)
    } catch (error: Exception) {
      if (job != null) {
        finishFailure(requireNotNull(job), "ERR_CLIP_RENDER_EXPORT", error)
      } else {
        throw error
      }
    }
  }

  private fun scheduleProgress(job: ExportJob) {
    val holder = ProgressHolder()
    val runnable = object : Runnable {
      override fun run() {
        if (activeJobs[job.id] !== job) return
        if (job.transformer.getProgress(holder) == Transformer.PROGRESS_STATE_AVAILABLE) {
          sendEvent(
            "onExportProgress",
            mapOf("jobId" to job.id, "progress" to holder.progress.coerceIn(0, 100))
          )
        }
        mainHandler.postDelayed(this, PROGRESS_INTERVAL_MS)
      }
    }
    job.progressHandler = runnable
    mainHandler.post(runnable)
  }

  private fun finishSuccess(job: ExportJob) {
    if (activeJobs.remove(job.id) !== job) return
    job.progressHandler?.let(mainHandler::removeCallbacks)
    job.overlayBitmap.recycle()

    try {
      val outputInfo = inspectOutput(job.outputFile)
      require(outputInfo.durationMs in 1..MAX_CLIP_DURATION_MS) {
        "Rendered video duration is outside the allowed 1–20 second range."
      }
      require(outputInfo.videoMime == MimeTypes.VIDEO_H264) {
        "The renderer did not produce an H.264 video."
      }
      require(
        max(outputInfo.width, outputInfo.height) <= MAX_LONG_EDGE &&
          min(outputInfo.width, outputInfo.height) <= MAX_SHORT_EDGE
      ) {
        "Rendered video exceeds the 1080p dimension limit."
      }
      require(!outputInfo.hasAudio || outputInfo.audioMime == MimeTypes.AUDIO_AAC) {
        "The renderer did not produce AAC audio."
      }
      sendEvent("onExportProgress", mapOf("jobId" to job.id, "progress" to 100))
      job.promise.resolve(
        mapOf(
          "jobId" to job.id,
          "uri" to Uri.fromFile(job.outputFile).toString(),
          "durationMs" to outputInfo.durationMs,
          "width" to outputInfo.width,
          "height" to outputInfo.height,
          "format" to "mp4",
          "videoCodec" to "H.264",
          "hasAudio" to outputInfo.hasAudio,
          "sizeBytes" to job.outputFile.length()
        )
      )
    } catch (error: Exception) {
      job.outputFile.delete()
      job.promise.reject("ERR_CLIP_RENDER_OUTPUT", error.message, error)
    }
  }

  private fun finishFailure(job: ExportJob, code: String, error: Exception) {
    if (activeJobs.remove(job.id) !== job) return
    job.progressHandler?.let(mainHandler::removeCallbacks)
    job.overlayBitmap.recycle()
    job.outputFile.delete()
    job.promise.reject(code, error.message ?: "Video export failed.", error)
  }

  private fun readInputInfo(uri: Uri): VideoInfo {
    val retriever = MediaMetadataRetriever()
    try {
      retriever.setDataSource(
        requireNotNull(appContext.reactContext) { "The React Native context is not available." },
        uri
      )
      val duration = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)
        ?.toLongOrNull() ?: throw IllegalArgumentException("Could not read the source video duration.")
      val rawWidth = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)
        ?.toIntOrNull() ?: throw IllegalArgumentException("Could not read the source video width.")
      val rawHeight = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)
        ?.toIntOrNull() ?: throw IllegalArgumentException("Could not read the source video height.")
      val rotation = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION)
        ?.toIntOrNull() ?: 0
      val swapsDimensions = rotation == 90 || rotation == 270
      return VideoInfo(
        durationMs = duration,
        width = if (swapsDimensions) rawHeight else rawWidth,
        height = if (swapsDimensions) rawWidth else rawHeight
      )
    } finally {
      retriever.release()
    }

    private fun readImageInfo(uri: Uri): VideoInfo {
      val context = requireNotNull(appContext.reactContext) { "The React Native context is not available." }
      val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
      val stream = if (uri.scheme == "content") {
        context.contentResolver.openInputStream(uri)
      } else {
        File(requireNotNull(uri.path)).inputStream()
      }
      stream.use { BitmapFactory.decodeStream(it, null, bounds) }
      require(bounds.outWidth > 0 && bounds.outHeight > 0) { "Could not read the selected image dimensions." }
      return VideoInfo(IMAGE_CLIP_DURATION_MS, bounds.outWidth, bounds.outHeight)
    }
  }

  private fun getOutputSize(sourceWidth: Int, sourceHeight: Int): Pair<Int, Int> {
    require(sourceWidth > 0 && sourceHeight > 0) { "The source video has invalid dimensions." }
    val scale = min(
      1.0,
      min(
        MAX_LONG_EDGE.toDouble() / max(sourceWidth, sourceHeight),
        MAX_SHORT_EDGE.toDouble() / min(sourceWidth, sourceHeight)
      )
    )
    val width = (sourceWidth * scale).roundToInt().coerceAtLeast(2) and -2
    val height = (sourceHeight * scale).roundToInt().coerceAtLeast(2) and -2
    return width to height
  }

  private fun createOverlayBitmap(
    width: Int,
    height: Int,
    text: String,
    textColor: Int,
    backgroundColor: Int?,
    x: Float,
    y: Float
  ): Bitmap {
    val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    if (text.isBlank()) return bitmap
    val canvas = Canvas(bitmap)
    val lines = text.split('\n').take(MAX_OVERLAY_LINES)
    val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = textColor
      textAlign = Paint.Align.CENTER
      typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
      textSize = max(18f, min(width, height) * TEXT_SIZE_RATIO)
    }
    val maxTextWidth = width * MAX_TEXT_WIDTH_RATIO
    val measuredWidth = lines.maxOf { paint.measureText(it) }.coerceAtLeast(1f)
    if (measuredWidth > maxTextWidth) {
      paint.textSize *= maxTextWidth / measuredWidth
    }
    val lineHeight = paint.fontSpacing
    val contentWidth = lines.maxOf { paint.measureText(it) }
    val contentHeight = lineHeight * lines.size
    val centerX = x * width
    val centerY = y * height
    val paddingX = paint.textSize * BACKGROUND_PADDING_RATIO
    val paddingY = paint.textSize * BACKGROUND_PADDING_RATIO / 2f

    if (backgroundColor != null) {
      val backgroundPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = backgroundColor }
      canvas.drawRoundRect(
        RectF(
          centerX - contentWidth / 2f - paddingX,
          centerY - contentHeight / 2f - paddingY,
          centerX + contentWidth / 2f + paddingX,
          centerY + contentHeight / 2f + paddingY
        ),
        paint.textSize * 0.22f,
        paint.textSize * 0.22f,
        backgroundPaint
      )
    }

    lines.forEachIndexed { index, line ->
      val baseline = centerY - contentHeight / 2f + lineHeight * (index + 0.5f) -
        (paint.ascent() + paint.descent()) / 2f
      canvas.drawText(line, centerX, baseline, paint)
    }
    return bitmap
  }

  private fun inspectOutput(file: File): OutputInfo {
    require(file.isFile && file.length() > 0L) { "The export did not create an output video." }
    val extractor = MediaExtractor()
    try {
      extractor.setDataSource(file.absolutePath)
      var videoMime: String? = null
      var audioMime: String? = null
      var hasAudio = false
      for (index in 0 until extractor.trackCount) {
        val mime = extractor.getTrackFormat(index).getString(MediaFormat.KEY_MIME) ?: continue
        if (mime.startsWith("video/")) videoMime = mime
        if (mime.startsWith("audio/")) {
          audioMime = mime
          hasAudio = true
        }
      }
      val retriever = MediaMetadataRetriever()
      val width: Int
      val height: Int
      val duration: Long
      try {
        retriever.setDataSource(file.absolutePath)
        val rawWidth = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)
          ?.toIntOrNull() ?: throw IllegalArgumentException("Could not read the rendered video width.")
        val rawHeight = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)
          ?.toIntOrNull() ?: throw IllegalArgumentException("Could not read the rendered video height.")
        val rotation = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION)
          ?.toIntOrNull() ?: 0
        val swapsDimensions = rotation == 90 || rotation == 270
        width = if (swapsDimensions) rawHeight else rawWidth
        height = if (swapsDimensions) rawWidth else rawHeight
        duration = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)
          ?.toLongOrNull() ?: throw IllegalArgumentException("Could not read the rendered video duration.")
      } finally {
        retriever.release()
      }
      return OutputInfo(duration, width, height, videoMime, audioMime, hasAudio)
    } finally {
      extractor.release()
    }
  }

  private fun Map<String, Any?>.requiredString(key: String): String =
    this[key] as? String ?: throw IllegalArgumentException("Missing or invalid $key.")

  private fun Map<String, Any?>.requiredNumber(key: String): Double =
    (this[key] as? Number)?.toDouble()?.takeIf(Double::isFinite)
      ?: throw IllegalArgumentException("Missing or invalid $key.")

  private fun Map<String, Any?>.requiredLong(key: String): Long {
    val value = requiredNumber(key)
    require(value % 1.0 == 0.0 && value <= Long.MAX_VALUE.toDouble()) {
      "$key must be a whole number of milliseconds."
    }
    return value.toLong()
  }

  private fun parseColor(value: String, label: String): Int = try {
    Color.parseColor(value)
  } catch (error: IllegalArgumentException) {
    throw IllegalArgumentException("$label must be a valid color such as #FFFFFF.", error)
  }

  private data class RenderRequest(
    val jobId: String,
    val sourceUri: Uri,
    val sourceType: String,
    val startMs: Long,
    val endMs: Long,
    val text: String,
    val textColor: Int,
    val backgroundColor: Int?,
    val x: Float,
    val y: Float
  )

  private data class VideoInfo(val durationMs: Long, val width: Int, val height: Int)

  private data class PreparedExport(
    val request: RenderRequest,
    val outputWidth: Int,
    val outputHeight: Int,
    val overlayBitmap: Bitmap,
    val outputFile: File
  )

  private data class OutputInfo(
    val durationMs: Long,
    val width: Int,
    val height: Int,
    val videoMime: String?,
    val audioMime: String?,
    val hasAudio: Boolean
  )

  private data class ExportJob(
    val id: String,
    val transformer: Transformer,
    val outputFile: File,
    val promise: Promise,
    val overlayBitmap: Bitmap,
    var progressHandler: Runnable? = null
  )

  private companion object {
    const val OUTPUT_FILE_PREFIX = "clip-render-"
    const val MAX_CLIP_DURATION_MS = 20_000L
    const val IMAGE_CLIP_DURATION_MS = 5_000L
    const val MAX_LONG_EDGE = 1920
    const val MAX_SHORT_EDGE = 1080
    const val MAX_OVERLAY_CHARACTERS = 120
    const val MAX_OVERLAY_LINES = 3
    const val TEXT_SIZE_RATIO = 0.055f
    const val MAX_TEXT_WIDTH_RATIO = 0.88f
    const val BACKGROUND_PADDING_RATIO = 0.45f
    const val PROGRESS_INTERVAL_MS = 250L
  }
}
