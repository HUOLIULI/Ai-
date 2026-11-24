import { colorGradeParamsToLut, COLOR_GRADE_SCHEMA, normalizeColorGrade } from '../colorGrade';

describe('normalizeColorGrade', () => {
  it('clamps parameters into their valid ranges', () => {
    const p = normalizeColorGrade({ temperature: 999, exposure: -9, contrast: 9, saturation: -9, tint: 99 });
    expect(p.temperature).toBeGreaterThanOrEqual(-1);
    expect(p.temperature).toBeLessThanOrEqual(1);
    expect(p.exposure).toBeGreaterThanOrEqual(-1);
    expect(p.contrast).toBeLessThanOrEqual(1);
    expect(p.saturation).toBeGreaterThanOrEqual(-1);
    expect(p.tint).toBeGreaterThanOrEqual(-1);
    expect(p.tint).toBeLessThanOrEqual(1);
  });

  it('fills missing parameters with neutral defaults', () => {
    const p = normalizeColorGrade({});
    expect(p).toEqual({ temperature: 0, exposure: 0, contrast: 0, saturation: 0, tint: 0 });
  });

  it('treats non-finite values as neutral', () => {
    expect(normalizeColorGrade({ temperature: NaN }).temperature).toBe(0);
    expect(normalizeColorGrade({ contrast: Infinity }).contrast).toBe(0);
  });
});

describe('colorGradeParamsToLut', () => {
  it('returns an identity-ish LUT for neutral parameters', () => {
    const lut = colorGradeParamsToLut({ temperature: 0, exposure: 0, contrast: 0, saturation: 0, tint: 0 });
    expect(lut.matrix).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    expect(lut.temperature).toBe(0);
    expect(lut.curve).toBeUndefined();
  });

  it('warms the temperature shift for a positive temperature', () => {
    const warm = colorGradeParamsToLut({ temperature: 0, exposure: 0, contrast: 0, saturation: 0, tint: 0, });
    const heated = colorGradeParamsToLut({ temperature: 0.5, exposure: 0, contrast: 0, saturation: 0, tint: 0 });
    expect((heated.temperature ?? 0)).toBeGreaterThan((warm.temperature ?? 0));
  });

  it('boosts saturation above identity in the matrix diagonal', () => {
    const lut = colorGradeParamsToLut({ temperature: 0, exposure: 0, contrast: 0, saturation: 0.5, tint: 0 });
    // Saturation mixes channels toward/away from luma; diagonal stays positive
    // but the off-diagonal (mixing) terms become non-zero.
    expect(lut.matrix[0]).toBeGreaterThan(1);
    expect(lut.matrix[1]).toBeLessThan(0);
  });

  it('adds a tone curve when contrast is non-zero', () => {
    const flat = colorGradeParamsToLut({ temperature: 0, exposure: 0, contrast: 0, saturation: 0, tint: 0 });
    const punchy = colorGradeParamsToLut({ temperature: 0, exposure: 0, contrast: 0.4, saturation: 0, tint: 0 });
    expect(flat.curve).toBeUndefined();
    expect(punchy.curve).toBeDefined();
    expect(punchy.curve!.length).toBeGreaterThanOrEqual(2);
  });

  it('lifts exposure through the curve or matrix without clipping to zero', () => {
    const lut = colorGradeParamsToLut({ temperature: 0, exposure: 0.5, contrast: 0, saturation: 0, tint: 0 });
    // A positive exposure must brighten midtones, not collapse them.
    const hasLift = (lut.curve ?? []).some(([, y]) => y > 0.5);
    expect(hasLift || lut.matrix.some(v => v > 1)).toBe(true);
  });
});

describe('COLOR_GRADE_SCHEMA', () => {
  it('exposes the five tunable parameters', () => {
    const keys = Object.keys(COLOR_GRADE_SCHEMA.properties);
    expect(keys).toEqual(expect.arrayContaining(['temperature', 'exposure', 'contrast', 'saturation', 'tint']));
  });
});
