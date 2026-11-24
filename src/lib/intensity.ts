import { COLOR_GRADE_PARAMS, normalizeColorGrade, type ColorGradeParams } from './colorGrade';
import { BEAUTY_PARAMS, normalizeBeauty, type BeautyParams } from './beauty';

// Strength scaling for AI enhancement results. The vision models return bounded
// parameters in their full range; scaling lets the user dial an effect back
// toward neutral without re-running the model. Pure math so the behaviour stays
// testable and identical across the capture flow and the review screen.

// Multiplies a bounded parameter set toward neutral by a strength in [0, 1].
// strength=1 keeps the effect at full strength, strength=0 returns neutral.
// Scaling toward neutral (rather than clipping the top) preserves the sign and
// relative shape of the model's output; the normalizer re-clamps each field to
// its own range and folds -0 to 0.

function scaleRecord(params: Record<string, number>, keys: readonly string[], strength: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of keys) {
    const v = params[key] * strength;
    // A negative parameter scaled to zero yields -0; fold it to +0 so the
    // downstream normalizers and LUT math never see a negative zero.
    out[key] = v === 0 ? 0 : v;
  }
  return out;
}

// Scales a color grade (temperature / exposure / contrast / saturation / tint),
// each in [-1, 1], toward neutral.
export function scaleColorGrade(params: ColorGradeParams, strength: number): ColorGradeParams {
  return normalizeColorGrade(scaleRecord(params, COLOR_GRADE_PARAMS, strength) as never);
}

// Scales a beauty look (smoothing / brightening in [0, 1], warmth in [-1, 1])
// toward neutral.
export function scaleBeauty(params: BeautyParams, strength: number): BeautyParams {
  return normalizeBeauty(scaleRecord(params, BEAUTY_PARAMS, strength) as never);
}
