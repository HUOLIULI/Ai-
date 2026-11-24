import type { LutSpec } from '../plugin/types';
import { colorGradeParamsToLut, type ColorGradeParams } from './colorGrade';

// AI-driven beauty. The vision model inspects a portrait and returns three
// bounded parameters; we compile them into the same LutSpec the color-grade and
// style pipeline already applies. Smoothing reads as softened micro-contrast, so
// it maps to a negative (flattening) contrast; brightening lifts exposure;
// warmth shifts the white balance. Spatial effects (real skin blur, eye
// brightening) are out of scope for the LUT engine and left for a later GPU
// backend.

export type BeautyParams = {
  // Skin softening, 0 = off, 1 = strongest (mapped to flattened contrast).
  smoothing: number;
  // Overall brightening, 0 = off, 1 = strongest (mapped to exposure lift).
  brightening: number;
  // Skin warmth, -1 cool, +1 warm (mapped to temperature).
  warmth: number;
};

export const BEAUTY_PARAMS: (keyof BeautyParams)[] = ['smoothing', 'brightening', 'warmth'];

const NEUTRAL: BeautyParams = { smoothing: 0, brightening: 0, warmth: 0 };

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export function normalizeBeauty(raw: Partial<Record<keyof BeautyParams, number>>): BeautyParams {
  const out = { ...NEUTRAL };
  for (const key of BEAUTY_PARAMS) {
    const v = raw[key];
    if (typeof v === 'number' && Number.isFinite(v)) {
      out[key] = key === 'warmth' ? clamp(v, -1, 1) : clamp(v, 0, 1);
    }
  }
  return out;
}

// JSON schema handed to requestAICompletion so the model returns exactly these
// three bounded numbers.
export const BEAUTY_SCHEMA = {
  type: 'object',
  properties: {
    smoothing: { type: 'number', description: 'Skin softening, 0 off to 1 strongest.' },
    brightening: { type: 'number', description: 'Brightening, 0 off to 1 strongest.' },
    warmth: { type: 'number', description: 'Skin warmth, -1 cool to +1 warm.' },
  },
  required: ['smoothing', 'brightening', 'warmth'],
} as const;

// Map beauty parameters onto the color-grade space so the LUT engine can apply
// them. Smoothing deliberately maps to a negative (flattening) contrast: a
// gentler tone curve reads as softer, smoother skin without spatial blur.
export function beautyParamsToColorGrade(p: Partial<Record<keyof BeautyParams, number>>): ColorGradeParams {
  const n = normalizeBeauty(p);
  return {
    temperature: n.warmth,
    exposure: n.brightening * 0.5,
    contrast: n.smoothing === 0 ? 0 : -n.smoothing * 0.6,
    saturation: 0,
    tint: 0,
  };
}

export function beautyParamsToLut(raw: Partial<Record<keyof BeautyParams, number>>): LutSpec {
  return colorGradeParamsToLut(beautyParamsToColorGrade(raw));
}
