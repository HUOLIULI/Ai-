import { scaleColorGrade, scaleBeauty } from '../intensity';

const fullGrade = { temperature: 0.8, exposure: -0.6, contrast: 0.4, saturation: 1, tint: -0.2 };

describe('scaleColorGrade', () => {
  it('keeps full strength unchanged', () => {
    expect(scaleColorGrade(fullGrade, 1)).toEqual(fullGrade);
  });

  it('returns neutral at zero strength', () => {
    expect(scaleColorGrade(fullGrade, 0)).toEqual({ temperature: 0, exposure: 0, contrast: 0, saturation: 0, tint: 0 });
  });

  it('scales toward neutral at half strength, preserving signs', () => {
    const out = scaleColorGrade(fullGrade, 0.5);
    expect(out.temperature).toBeCloseTo(0.4);
    expect(out.exposure).toBeCloseTo(-0.3);
    expect(out.saturation).toBeCloseTo(0.5);
    expect(out.tint).toBeCloseTo(-0.1);
  });

  it('folds negative zero to zero', () => {
    const out = scaleColorGrade({ temperature: -0.5, exposure: 0, contrast: 0, saturation: 0, tint: 0 }, 0);
    expect(out.temperature).toBe(0);
    expect(Object.is(out.temperature, -0)).toBe(false);
  });
});

describe('scaleBeauty', () => {
  const fullLook = { smoothing: 0.8, brightening: 0.6, warmth: -0.4 };

  it('keeps full strength unchanged', () => {
    expect(scaleBeauty(fullLook, 1)).toEqual(fullLook);
  });

  it('returns neutral at zero strength', () => {
    expect(scaleBeauty(fullLook, 0)).toEqual({ smoothing: 0, brightening: 0, warmth: 0 });
  });

  it('scales toward neutral at half strength', () => {
    const out = scaleBeauty(fullLook, 0.5);
    expect(out.smoothing).toBeCloseTo(0.4);
    expect(out.brightening).toBeCloseTo(0.3);
    expect(out.warmth).toBeCloseTo(-0.2);
  });

  it('keeps scaled values within each field range', () => {
    const out = scaleBeauty({ smoothing: 1, brightening: 1, warmth: 1 }, 1);
    expect(out).toEqual({ smoothing: 1, brightening: 1, warmth: 1 });
  });
});
