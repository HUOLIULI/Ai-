// Offline photo quality guard: after the shutter fires, assess the captured
// frame for blur / exposure / closed eyes and advise a retake on obvious duds.
// The assessment is a pure function over pixel stats so it is reproducible and
// unit-testable; the collection side (canvas decode / MLKit landmarks) feeds it.

export type QualityStats = {
  sharpness: number;
  mean: number;
  highlights: number;
};

export type ExposureLevel = 'dark' | 'normal' | 'bright';

export type QualityReport = {
  blur: boolean;
  exposure: ExposureLevel;
  eyesOpen: boolean | null;
  shouldRetake: boolean;
  hints: string[];
};

// Thresholds are centralised so they can be recalibrated after on-device testing.
const BLUR_SHARPNESS = 6;
const DARK_MEAN = 40;
const BRIGHT_HIGHLIGHTS = 0.15;

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

// Computes blur / exposure stats from raw luminance bytes (one per entry).
// Sharpness is the mean absolute difference between horizontally adjacent
// pixels, a lightweight proxy for detail. Pure and total (never throws).
export function computeQualityStats(luma: Uint8Array): QualityStats {
  if (luma.length === 0) return { sharpness: 0, mean: 0, highlights: 0 };
  let sum = 0;
  let highlights = 0;
  let gradient = 0;
  let gradientSamples = 0;
  for (let i = 0; i < luma.length; i++) {
    const value = luma[i];
    sum += value;
    if (value >= 240) highlights++;
    // Compare each pixel to the previous one in the same row so vertical
    // row boundaries don't inflate the gradient.
    if (i > 0 && i % 64 !== 0) {
      gradient += Math.abs(value - luma[i - 1]);
      gradientSamples++;
    }
  }
  const mean = sum / luma.length;
  const sharpness = gradientSamples > 0 ? gradient / gradientSamples : 0;
  return { sharpness, mean, highlights: highlights / luma.length };
}

export function assessQuality(stats: QualityStats | null, eyesOpen: boolean | null): QualityReport {
  const hints: string[] = [];
  let blur = false;
  let exposure: ExposureLevel = 'normal';
  let statsEvaluated = false;

  if (stats && isFiniteNumber(stats.sharpness) && isFiniteNumber(stats.mean) && isFiniteNumber(stats.highlights)) {
    statsEvaluated = true;
    if (stats.sharpness < BLUR_SHARPNESS) {
      blur = true;
      hints.push('成片可能模糊，建议稳住再拍一张。');
    }
    if (stats.mean < DARK_MEAN) {
      exposure = 'dark';
      hints.push('成片偏暗，建议补光后重拍。');
    } else if (stats.highlights > BRIGHT_HIGHLIGHTS) {
      exposure = 'bright';
      hints.push('成片过曝，建议降低曝光或避开强光重拍。');
    }
  } else {
    hints.push('像素数据无法评估，跳过模糊与曝光检测。');
  }

  let eyesState: boolean | null = null;
  if (eyesOpen === false) {
    eyesState = false;
    hints.push('检测到闭眼，建议重拍避免眨眼瞬间。');
  } else if (eyesOpen === true) {
    eyesState = true;
  }

  const shouldRetake = blur || exposure !== 'normal' || eyesState === false;
  // A clean capture gets an explicit all-clear so the caller can trust the absence of hints.
  if (!shouldRetake && statsEvaluated && eyesState !== false && hints.length === 1 && hints[0].startsWith('像素数据无法评估')) {
    hints.length = 0;
    hints.push('成片正常。');
  } else if (!shouldRetake && hints.length === 0) {
    hints.push('成片正常。');
  }

  return { blur, exposure, eyesOpen: eyesState, shouldRetake, hints };
}
