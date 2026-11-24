import { beautyParamsToColorGrade, beautyParamsToLut, BEAUTY_SCHEMA, normalizeBeauty } from '../beauty';

describe('normalizeBeauty', () => {
  it('clamps parameters into [0, 1] (warmth into [-1, 1])', () => {
    const p = normalizeBeauty({ smoothing: 9, brightening: -9, warmth: 9 });
    expect(p.smoothing).toBe(1);
    expect(p.brightening).toBe(0);
    expect(p.warmth).toBe(1);
  });

  it('fills missing parameters with neutral defaults', () => {
    expect(normalizeBeauty({})).toEqual({ smoothing: 0, brightening: 0, warmth: 0 });
  });

  it('treats non-finite values as neutral', () => {
    expect(normalizeBeauty({ smoothing: NaN }).smoothing).toBe(0);
    expect(normalizeBeauty({ warmth: Infinity }).warmth).toBe(0);
  });
});

describe('beautyParamsToColorGrade', () => {
  it('maps smoothing to a negative (flattening) contrast', () => {
    const g = beautyParamsToColorGrade({ smoothing: 0.8, brightening: 0, warmth: 0 });
    expect(g.contrast).toBeLessThan(0);
  });

  it('maps brightening to a positive exposure', () => {
    const g = beautyParamsToColorGrade({ smoothing: 0, brightening: 0.6, warmth: 0 });
    expect(g.exposure).toBeGreaterThan(0);
  });

  it('maps warmth to temperature with the same sign', () => {
    expect(beautyParamsToColorGrade({ smoothing: 0, brightening: 0, warmth: 0.5 }).temperature).toBeGreaterThan(0);
    expect(beautyParamsToColorGrade({ smoothing: 0, brightening: 0, warmth: -0.5 }).temperature).toBeLessThan(0);
  });

  it('stays neutral for zero beauty parameters', () => {
    const g = beautyParamsToColorGrade({ smoothing: 0, brightening: 0, warmth: 0 });
    expect(g).toEqual({ temperature: 0, exposure: 0, contrast: 0, saturation: 0, tint: 0 });
  });
});

describe('beautyParamsToLut', () => {
  it('produces an identity-ish LUT for neutral parameters', () => {
    const lut = beautyParamsToLut({ smoothing: 0, brightening: 0, warmth: 0 });
    expect(lut.matrix).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    expect(lut.temperature).toBe(0);
  });

  it('softens the tone curve when smoothing is applied', () => {
    const lut = beautyParamsToLut({ smoothing: 0.7, brightening: 0, warmth: 0 });
    expect(lut.curve).toBeDefined();
  });

  it('warms the result when warmth is positive', () => {
    const lut = beautyParamsToLut({ smoothing: 0, brightening: 0, warmth: 0.5 });
    expect(lut.temperature).toBeGreaterThan(0);
  });
});

describe('BEAUTY_SCHEMA', () => {
  it('exposes the three beauty parameters', () => {
    expect(Object.keys(BEAUTY_SCHEMA.properties)).toEqual(expect.arrayContaining(['smoothing', 'brightening', 'warmth']));
  });
});
