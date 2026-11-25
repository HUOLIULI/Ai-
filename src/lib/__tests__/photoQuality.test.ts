import { assessQuality, computeQualityStats, eyeStateFromProbabilities, type QualityStats } from '../photoQuality';

// A "sharp" synthetic frame: strong alternating gradient between neighbours.
function sharpLuma(size = 64): Uint8Array {
  const out = new Uint8Array(size * size);
  for (let i = 0; i < out.length; i++) out[i] = i % 2 === 0 ? 40 : 200;
  return out;
}

// A "flat" synthetic frame: uniform value, zero gradient => blurry.
function flatLuma(size = 64, value = 128): Uint8Array {
  return new Uint8Array(size * size).fill(value);
}

const clear: QualityStats = { sharpness: 30, mean: 120, highlights: 0.01 };

describe('computeQualityStats', () => {
  it('scores a high-contrast frame as sharp', () => {
    const stats = computeQualityStats(sharpLuma());
    expect(stats.sharpness).toBeGreaterThan(10);
  });

  it('scores a uniform frame as blurry (near-zero sharpness)', () => {
    const stats = computeQualityStats(flatLuma());
    expect(stats.sharpness).toBeLessThan(1);
  });

  it('reports mean and highlight ratio', () => {
    const stats = computeQualityStats(flatLuma(64, 250));
    expect(stats.mean).toBe(250);
    expect(stats.highlights).toBe(1);
  });

  it('handles an empty frame without throwing', () => {
    expect(() => computeQualityStats(new Uint8Array(0))).not.toThrow();
  });
});

describe('eyeStateFromProbabilities', () => {
  it('reports eyes closed when both eyes are below the threshold', () => {
    expect(eyeStateFromProbabilities(0.1, 0.2)).toBe(false);
  });

  it('reports eyes open when both eyes are above the threshold', () => {
    expect(eyeStateFromProbabilities(0.9, 0.85)).toBe(true);
  });

  it('treats one open eye as open (a blink rarely closes both symmetrically)', () => {
    expect(eyeStateFromProbabilities(0.9, 0.1)).toBe(true);
  });

  it('returns null when a probability is unavailable', () => {
    expect(eyeStateFromProbabilities(null, 0.9)).toBeNull();
    expect(eyeStateFromProbabilities(0.9, null)).toBeNull();
  });

  it('returns null when no face is present', () => {
    expect(eyeStateFromProbabilities(null, null)).toBeNull();
  });
});

describe('assessQuality', () => {
  it('flags a blurry frame and suggests a retake', () => {
    const report = assessQuality({ ...clear, sharpness: 2 }, null);
    expect(report.blur).toBe(true);
    expect(report.shouldRetake).toBe(true);
    expect(report.hints.some((hint) => hint.includes('模糊'))).toBe(true);
  });

  it('marks a sharp frame as not blurry', () => {
    const report = assessQuality(clear, null);
    expect(report.blur).toBe(false);
  });

  it('flags a dark frame', () => {
    const report = assessQuality({ ...clear, mean: 25 }, null);
    expect(report.exposure).toBe('dark');
    expect(report.shouldRetake).toBe(true);
    expect(report.hints.some((hint) => hint.includes('偏暗'))).toBe(true);
  });

  it('flags a blown-out frame', () => {
    const report = assessQuality({ ...clear, highlights: 0.4 }, null);
    expect(report.exposure).toBe('bright');
    expect(report.shouldRetake).toBe(true);
    expect(report.hints.some((hint) => hint.includes('过曝'))).toBe(true);
  });

  it('reports normal exposure for a well-lit frame', () => {
    const report = assessQuality(clear, null);
    expect(report.exposure).toBe('normal');
  });

  it('flags closed eyes', () => {
    const report = assessQuality(clear, false);
    expect(report.eyesOpen).toBe(false);
    expect(report.shouldRetake).toBe(true);
    expect(report.hints.some((hint) => hint.includes('闭眼'))).toBe(true);
  });

  it('treats open eyes as fine', () => {
    const report = assessQuality(clear, true);
    expect(report.eyesOpen).toBe(true);
  });

  it('skips blur and exposure when pixel stats are unavailable', () => {
    const report = assessQuality(null, null);
    expect(report.blur).toBe(false);
    expect(report.exposure).toBe('normal');
    expect(report.shouldRetake).toBe(false);
    expect(report.hints.some((hint) => hint.includes('无法评估'))).toBe(true);
  });

  it('never blocks saving when everything is unevaluable', () => {
    const report = assessQuality(null, null);
    expect(report.shouldRetake).toBe(false);
  });

  it('is a pure function: same input yields deep-equal output', () => {
    expect(assessQuality(clear, true)).toEqual(assessQuality(clear, true));
  });
});
