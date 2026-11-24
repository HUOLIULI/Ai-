import type { CameraStyle, WhiteBalance } from '../types/guidance';
import { CAMERA_STYLE_PRESETS } from '../constants/guidance';

// Offline shutter decision: at the moment the shutter fires, derive a set of
// capture adjustments from on-device signals alone. No network, no model key.
// This is a pure function so the same signals always yield the same decision.
export type ShutterSignals = {
  lighting: { mean: number; highlights: number } | null;
  faces: { count: number } | null;
  stability: { shake: number } | null;
};

export type ExposureLevel = 'dark' | 'normal' | 'bright';
export type StabilityLevel = 'stable' | 'shaky' | 'unknown';

export type ShutterDecision = {
  whiteBalance: WhiteBalance;
  style: CameraStyle;
  exposure: { level: ExposureLevel; hint: string };
  stability: { level: StabilityLevel; hint: string };
  reasons: string[];
};

// Thresholds are centralised so they can be recalibrated after on-device testing.
const DARK_MEAN = 50;
const BRIGHT_HIGHLIGHTS = 0.15;
const SHAKY_SHAKE = 0.9;
const DEFAULT_STYLE: CameraStyle = '清透';
const PORTRAIT_STYLE: CameraStyle = '奶杏';
const LOW_LIGHT_STYLE: CameraStyle = '奶杏';

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function decideShutter(signals: ShutterSignals): ShutterDecision {
  const reasons: string[] = [];
  const lighting = signals.lighting;
  const faces = signals.faces;
  const stability = signals.stability;

  // Exposure level from frame luminance; missing/invalid lighting falls back to normal.
  let exposure: ExposureLevel = 'normal';
  let exposureHint = '曝光正常，直接拍即可。';
  if (lighting && isFiniteNumber(lighting.mean) && isFiniteNumber(lighting.highlights)) {
    if (lighting.mean < DARK_MEAN) {
      exposure = 'dark';
      exposureHint = '画面偏暗，建议开闪光或补光后再拍。';
      reasons.push('采样帧亮度偏暗，判定为暗光场景。');
    } else if (lighting.highlights > BRIGHT_HIGHLIGHTS) {
      exposure = 'bright';
      exposureHint = '画面高光过多，建议降低曝光或避开强光。';
      reasons.push('采样帧高光占比过高，判定为过曝风险。');
    }
  } else {
    reasons.push('未检测到光照数据，曝光按正常处理。');
  }

  // Style from scene cues. Dark light takes precedence over portrait so the
  // frame gets brightened; otherwise a face suggests the portrait look.
  let style: CameraStyle = DEFAULT_STYLE;
  const dark = exposure === 'dark';
  if (dark) {
    style = LOW_LIGHT_STYLE;
    reasons.push('暗光下改用偏暖提亮的风格。');
  } else if (faces && isFiniteNumber(faces.count) && faces.count >= 1) {
    style = PORTRAIT_STYLE;
    reasons.push('检测到人脸，建议人像风格。');
  } else {
    reasons.push('按当前默认风格拍摄。');
  }

  // White balance derives from the chosen style preset so decisions stay
  // consistent with the existing CAMERA_STYLE_PRESETS.
  const whiteBalance = CAMERA_STYLE_PRESETS[style].whiteBalance;

  // Stability from gyroscope; unknown when unavailable.
  let stabilityLevel: StabilityLevel = 'unknown';
  let stabilityHint = '陀螺仪不可用，无法判断手持稳定性。';
  if (stability && isFiniteNumber(stability.shake)) {
    if (stability.shake > SHAKY_SHAKE) {
      stabilityLevel = 'shaky';
      stabilityHint = '手持不稳，请稳住再拍，避免成片模糊。';
      reasons.push('陀螺仪检测到明显晃动。');
    } else {
      stabilityLevel = 'stable';
      stabilityHint = '手持稳定，可以稳拍。';
    }
  } else {
    reasons.push('陀螺仪不可用，稳定性按未知处理。');
  }

  return { whiteBalance, style, exposure: { level: exposure, hint: exposureHint }, stability: { level: stabilityLevel, hint: stabilityHint }, reasons };
}
