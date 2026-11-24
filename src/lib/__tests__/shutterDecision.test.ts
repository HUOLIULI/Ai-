import { decideShutter, type ShutterSignals } from '../shutterDecision';

const base: ShutterSignals = {
  lighting: { mean: 120, highlights: 0.02 },
  faces: { count: 0 },
  stability: { shake: 0.1 },
};

describe('decideShutter (offline shutter decision)', () => {
  it('flags dark frames and suggests fill light with a warm style', () => {
    const decision = decideShutter({ ...base, lighting: { mean: 30, highlights: 0.01 } });
    expect(decision.exposure.level).toBe('dark');
    expect(decision.exposure.hint).toContain('补光');
    expect(decision.style).toBe('奶杏');
    expect(decision.reasons.some((reason) => reason.includes('偏暗'))).toBe(true);
  });

  it('flags blown highlights and suggests lowering exposure', () => {
    const decision = decideShutter({ ...base, lighting: { mean: 150, highlights: 0.4 } });
    expect(decision.exposure.level).toBe('bright');
    expect(decision.exposure.hint).toContain('曝光');
    expect(decision.reasons.some((reason) => reason.includes('过曝'))).toBe(true);
  });

  it('reports normal exposure for a well-lit frame', () => {
    const decision = decideShutter(base);
    expect(decision.exposure.level).toBe('normal');
  });

  it('suggests a portrait style when a face is present', () => {
    const decision = decideShutter({ ...base, faces: { count: 1 } });
    expect(decision.style).toBe('奶杏');
    expect(decision.reasons.some((reason) => reason.includes('人像'))).toBe(true);
  });

  it('warns when the device is shaking', () => {
    const decision = decideShutter({ ...base, stability: { shake: 1.6 } });
    expect(decision.stability.level).toBe('shaky');
    expect(decision.stability.hint).toContain('稳');
    expect(decision.reasons.some((reason) => reason.includes('晃动'))).toBe(true);
  });

  it('stays stable under small motion', () => {
    const decision = decideShutter({ ...base, stability: { shake: 0.2 } });
    expect(decision.stability.level).toBe('stable');
  });

  it('degrades to neutral defaults when gyroscope is unavailable', () => {
    const decision = decideShutter({ ...base, stability: null });
    expect(decision.stability.level).toBe('unknown');
    expect(decision.reasons.some((reason) => reason.includes('陀螺仪'))).toBe(true);
  });

  it('degrades to current style when no face and no strong lighting signal', () => {
    const decision = decideShutter({ ...base, faces: null });
    expect(decision.style).toBe('清透');
  });

  it('degrades fully when all signals are missing', () => {
    const decision = decideShutter({ lighting: null, faces: null, stability: null });
    expect(decision.exposure.level).toBe('normal');
    expect(decision.stability.level).toBe('unknown');
    expect(decision.style).toBe('清透');
    expect(decision.whiteBalance).toBe('daylight');
  });

  it('never throws on invalid numeric input', () => {
    expect(() => decideShutter({ lighting: { mean: Number.NaN, highlights: 0 }, faces: null, stability: null })).not.toThrow();
  });

  it('is a pure function: same input yields deep-equal output', () => {
    const first = decideShutter(base);
    const second = decideShutter(base);
    expect(second).toEqual(first);
  });

  it('derives white balance from the chosen style preset', () => {
    const decision = decideShutter({ ...base, faces: { count: 1 } });
    expect(decision.whiteBalance).toBe('cloudy');
  });
});
