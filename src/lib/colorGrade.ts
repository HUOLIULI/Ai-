import type { LutSpec } from '../plugin/types';

// AI-driven color grade. The vision model inspects a frame and returns five
// signed parameters in [-1, 1]; we compile them into the same LutSpec the LUT
// engine already applies to the preview and the saved photo. Pure math here so
// the mapping stays testable and the model never has to emit pixel values.

export type ColorGradeParams = {
  // Warm (+) / cool (-) white-balance shift.
  temperature: number;
  // Overall brightness lift (+) / darkening (-).
  exposure: number;
  // Punch (+) / flat (-) via an S-curve around the midtones.
  contrast: number;
  // Vividness (+) / desaturation (-) via luma mixing.
  saturation: number;
  // Green (+) / magenta (-) tint correction.
  tint: number;
};

export const COLOR_GRADE_PARAMS: (keyof ColorGradeParams)[] = ['temperature', 'exposure', 'contrast', 'saturation', 'tint'];

const NEUTRAL: ColorGradeParams = { temperature: 0, exposure: 0, contrast: 0, saturation: 0, tint: 0 };

function clamp01(v: number) {
  return Math.max(-1, Math.min(1, v));
}

export function normalizeColorGrade(raw: Partial<Record<keyof ColorGradeParams, number>>): ColorGradeParams {
  const out = { ...NEUTRAL };
  for (const key of COLOR_GRADE_PARAMS) {
    const v = raw[key];
    out[key] = typeof v === 'number' && Number.isFinite(v) ? clamp01(v) : 0;
  }
  return out;
}

// JSON schema handed to requestAICompletion so the model returns exactly these
// five bounded numbers.
export const COLOR_GRADE_SCHEMA = {
  type: 'object',
  properties: {
    temperature: { type: 'number', description: 'White-balance shift, -1 cool to +1 warm.' },
    exposure: { type: 'number', description: 'Brightness, -1 darker to +1 brighter.' },
    contrast: { type: 'number', description: 'Punch, -1 flat to +1 punchy.' },
    saturation: { type: 'number', description: 'Vividness, -1 muted to +1 vivid.' },
    tint: { type: 'number', description: 'Green-magenta balance, -1 magenta to +1 green.' },
  },
  required: ['temperature', 'exposure', 'contrast', 'saturation', 'tint'],
} as const;

// Saturation mixes each channel toward/away from luma. The standard form uses a
// factor f where f=1 is identity, f>1 oversaturates, f=0 is grayscale. Map the
// signed param p to f = 1 + p so p=0 is neutral, p=+1 pushes the diagonal above
// identity (vivid), and p=-1 collapses toward luma (muted).
function saturationMatrix(p: number): number[] {
  if (p === 0) return [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const f = 1 + p;
  const lr = (1 - f) * 0.299;
  const lg = (1 - f) * 0.587;
  const lb = (1 - f) * 0.114;
  return [
    lr + f, lg, lb,
    lr, lg + f, lb,
    lr, lg, lb + f,
  ];
}

// Tint shifts green against a magenta (R+B) anchor.
function tintMatrix(t: number): number[] {
  if (t === 0) return [1, 0, 0, 0, 1, 0, 0, 0, 1];
  return [
    1, 0, 0,
    -0.5 * t, 1 + Math.abs(t) * 0.5, -0.5 * t,
    0, 0, 1,
  ];
}

function multiplyMatrix(a: number[], b: number[]): number[] {
  const out = new Array<number>(9).fill(0);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      let sum = 0;
      for (let k = 0; k < 3; k++) sum += a[row * 3 + k] * b[k * 3 + col];
      out[row * 3 + col] = sum;
    }
  }
  return out;
}

// Exposure lifts/drops midtones around a pivot; the curve stays anchored at
// pure black and pure white so we never clip them.
function exposureCurve(e: number): [number, number][] {
  if (e === 0) return [[0, 0], [1, 1]];
  const gain = 1 + e * 0.6;
  const lift = (t: number) => Math.max(0, Math.min(1, 0.5 + (t - 0.5) * gain));
  return [[0, 0], [0.25, lift(0.25)], [0.5, lift(0.5)], [0.75, lift(0.75)], [1, 1]];
}

// Contrast S-curve: darken shadows, brighten highlights, keep endpoints fixed.
function contrastCurve(c: number): [number, number][] {
  if (c === 0) return [[0, 0], [1, 1]];
  const k = c;
  const s = (t: number) => {
    const x = t * 2 - 1; // -1..1
    const y = x + k * (x - x * x * x); // skew away from flat
    return Math.max(0, Math.min(1, (y + 1) / 2));
  };
  return [[0, 0], [0.25, s(0.25)], [0.5, 0.5], [0.75, s(0.75)], [1, 1]];
}

function composeCurves(a: [number, number][], b: [number, number][]): [number, number][] {
  if (!a.length) return b;
  if (!b.length) return a;
  const xs = new Set([...a.map(p => p[0]), ...b.map(p => p[0])]);
  return [...xs].sort((x, y) => x - y).map(x => [x, applyCurvePoints(applyCurvePoints(x, a), b)] as [number, number]);
}

// Local copy of the LUT engine's piecewise-linear evaluation so this module has
// no dependency on the canvas backend.
function applyCurvePoints(t: number, curve: [number, number][]): number {
  if (t <= curve[0][0]) return curve[0][1];
  for (let i = 1; i < curve.length; i++) {
    if (t <= curve[i][0]) {
      const [x0, y0] = curve[i - 1];
      const [x1, y1] = curve[i];
      const f = (t - x0) / (x1 - x0);
      return y0 + f * (y1 - y0);
    }
  }
  return curve[curve.length - 1][1];
}

export function colorGradeParamsToLut(raw: Partial<Record<keyof ColorGradeParams, number>>): LutSpec {
  const p = normalizeColorGrade(raw);
  // Apply tint first, then saturation, so a saturation boost is not partially
  // cancelled by the tint matrix reducing the diagonal.
  const matrix = multiplyMatrix(saturationMatrix(p.saturation), tintMatrix(p.tint));
  const hasExposure = p.exposure !== 0;
  const hasContrast = p.contrast !== 0;
  const curve = hasExposure && hasContrast
    ? composeCurves(exposureCurve(p.exposure), contrastCurve(p.contrast))
    : hasExposure ? exposureCurve(p.exposure)
      : hasContrast ? contrastCurve(p.contrast)
        : undefined;
  const lut: LutSpec = { name: 'ai-color-grade', matrix, temperature: p.temperature };
  if (curve) lut.curve = curve;
  return lut;
}
