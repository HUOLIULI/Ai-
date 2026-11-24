package expo.modules.imagefilter

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream
import kotlin.math.floor
import kotlin.math.sin

// Applies the same LUT pixel math as the Web canvas backend (lutMath.ts) to a
// bitmap on device, so the AI color grade / beauty / NL-edit enhancements and
// the built-in style filters render identically on Android. Reads the source
// photo, runs the matrix -> temperature -> curve -> grain pipeline, and writes
// a new JPEG to the app cache, returning its file:// uri. Any failure resolves
// with the original uri so a filter error never blocks a capture.
class ImageFilterModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ImageFilter")
    AsyncFunction("apply") { uri: String, matrix: List<Double>, curve: List<Double>, temperature: Double, grain: Double, promise: Promise ->
      try {
        val context = appContext.reactContext ?: throw IllegalStateException("no react context")
        val out = applyLut(context, uri, matrix, curve, temperature, grain)
        promise.resolve(out)
      } catch (e: Exception) {
        promise.resolve(uri)
      }
    }
  }

  private fun applyLut(
    context: Context,
    uri: String,
    matrix: List<Double>,
    curve: List<Double>,
    temperature: Double,
    grain: Double
  ): String {
    val source = decodeBitmap(context, uri) ?: return uri
    val width = source.width
    val height = source.height
    val pixels = IntArray(width * height)
    source.getPixels(pixels, 0, width, 0, 0, width, height)

    val m = DoubleArray(9) { i -> if (i < matrix.size) matrix[i] else identityAt(i) }
    val temp = temperature / 255.0
    val hasCurve = curve.size >= 4
    val grainAmount = grain * 40.0
    val hasGrain = grain > 0.0

    for (i in pixels.indices) {
      val p = pixels[i]
      val r = (p shr 16 and 0xFF).toDouble()
      val g = (p shr 8 and 0xFF).toDouble()
      val b = (p and 0xFF).toDouble()
      val a = p ushr 24 and 0xFF

      var nr = m[0] * r + m[1] * g + m[2] * b
      var ng = m[3] * r + m[4] * g + m[5] * b
      var nb = m[6] * r + m[7] * g + m[8] * b

      nr += temp * 40.0
      nb -= temp * 40.0

      if (hasCurve) {
        nr = applyCurve(nr / 255.0, curve) * 255.0
        ng = applyCurve(ng / 255.0, curve) * 255.0
        nb = applyCurve(nb / 255.0, curve) * 255.0
      }

      if (hasGrain) {
        val x = i % width
        val y = i / width
        val h = sin(x * 12.9898 + y * 78.233) * 43758.5453
        val noise = h - floor(h)
        val amount = (noise - 0.5) * grainAmount
        nr += amount
        ng += amount
        nb += amount
      }

      pixels[i] = (a shl 24) or
        (clamp(nr) shl 16) or
        (clamp(ng) shl 8) or
        clamp(nb)
    }

    val out = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    out.setPixels(pixels, 0, width, 0, 0, width, height)
    source.recycle()

    val file = File(context.cacheDir, "drama-filter-${System.nanoTime()}.jpg")
    FileOutputStream(file).use { stream ->
      out.compress(Bitmap.CompressFormat.JPEG, 95, stream)
    }
    out.recycle()
    return Uri.fromFile(file).toString()
  }

  private fun decodeBitmap(context: Context, uri: String): Bitmap? {
    return try {
      val parsed = if (uri.startsWith("file:")) Uri.parse(uri) else Uri.fromFile(File(uri))
      context.contentResolver.openInputStream(parsed)?.use { stream ->
        BitmapFactory.decodeStream(stream)
      }
    } catch (e: Exception) {
      null
    }
  }

  // Piecewise-linear curve over flat control points [x0, y0, x1, y1, ...],
  // mirroring applyCurve in lutMath.ts.
  private fun applyCurve(t: Double, curve: List<Double>): Double {
    val firstX = curve[0]
    val firstY = curve[1]
    if (t <= firstX) return firstY
    var i = 2
    while (i + 1 < curve.size) {
      val x = curve[i]
      val y = curve[i + 1]
      if (t <= x) {
        val x0 = curve[i - 2]
        val y0 = curve[i - 1]
        val f = (t - x0) / (x - x0)
        return y0 + f * (y - y0)
      }
      i += 2
    }
    return curve[curve.size - 1]
  }

  private fun clamp(value: Double): Int {
    val rounded = Math.round(value).toInt()
    return if (rounded < 0) 0 else if (rounded > 255) 255 else rounded
  }

  private fun identityAt(i: Int): Double = if (i % 4 == 0) 1.0 else 0.0
}
