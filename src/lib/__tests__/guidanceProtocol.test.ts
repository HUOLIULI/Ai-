import { parseGuidanceProtocol, GuidanceProtocolError } from '../guidanceProtocol';
import { GUIDANCE_EXAMPLE } from '../../constants/guidanceProtocol';

function makeAdvice(overrides: Record<string, unknown> = {}) {
  return {
    version: 3,
    state: 'aim',
    summary: '稍向右上转动手机，对准目标圈',
    horizontal: 'hold', vertical: 'hold', tilt: 'hold', distance: 'hold', zoom: 'hold',
    light: '保持当前光线',
    confidence: 0.9,
    aimPoint: { x: 0.65, y: 0.4 },
    readyToShoot: false,
    route: { path: 'straight', holdMs: 800 },
    camera: { zoomFactor: null, flash: 'keep', aperture: null, contrast: null, whiteBalance: 'keep' },
    ...overrides,
  };
}
const json = (value: unknown) => JSON.stringify(value);

describe('parseGuidanceProtocol', () => {
  it('accepts the documented aim example', () => {
    expect(parseGuidanceProtocol(json(GUIDANCE_EXAMPLE))).toEqual(GUIDANCE_EXAMPLE);
  });

  it('rejects markdown-wrapped JSON', () => {
    expect(() => parseGuidanceProtocol('```json\n{}```')).toThrow(GuidanceProtocolError);
  });

  it('rejects non-JSON text', () => {
    expect(() => parseGuidanceProtocol('好的，向右转')).toThrow(/JSON 协议不匹配/);
  });

  it('rejects unknown extra fields', () => {
    const advice = makeAdvice();
    (advice as Record<string, unknown>).shotCount = 1;
    expect(() => parseGuidanceProtocol(json(advice))).toThrow(/额外字段/);
  });

  it('rejects a wrong version', () => {
    expect(() => parseGuidanceProtocol(json(makeAdvice({ version: 2 })))).toThrow(/枚举值不合法/);
  });

  it('rejects a non-enum state', () => {
    expect(() => parseGuidanceProtocol(json(makeAdvice({ state: 'focus' })))).toThrow(/枚举值不合法/);
  });

  describe('aim state', () => {
    it('requires an aimPoint, all actions hold, and no ready flag', () => {
      const bad = makeAdvice({ horizontal: 'left' });
      expect(() => parseGuidanceProtocol(json(bad))).toThrow(/aim/);
    });

    it('accepts a fresh aim with all actions hold', () => {
      const advice = makeAdvice();
      expect(parseGuidanceProtocol(json(advice)).state).toBe('aim');
    });
  });

  describe('adjust state', () => {
    it('accepts a zoom-only adjust with a valid zoomFactor', () => {
      const advice = makeAdvice({
        state: 'adjust',
        aimPoint: null,
        route: { path: 'none', holdMs: 800 },
        zoom: 'in',
        camera: { zoomFactor: null, flash: 'keep', aperture: null, contrast: null, whiteBalance: 'keep', ...{} },
      });
      (advice.camera as { zoomFactor: number | null }).zoomFactor = 1.4;
      expect(parseGuidanceProtocol(json(advice)).state).toBe('adjust');
    });

    it('rejects adjust when nothing changes', () => {
      const advice = makeAdvice({
        state: 'adjust',
        aimPoint: null,
        route: { path: 'none', holdMs: 800 },
      });
      expect(() => parseGuidanceProtocol(json(advice))).toThrow(/adjust/);
    });
  });

  describe('ready state', () => {
    it('accepts a centered ready with high confidence', () => {
      const advice = makeAdvice({
        state: 'ready',
        summary: '已对准，可以拍照了',
        aimPoint: { x: 0.5, y: 0.5 },
        readyToShoot: true,
        confidence: 0.9,
        route: { path: 'none', holdMs: 800 },
      });
      expect(parseGuidanceProtocol(json(advice)).state).toBe('ready');
    });

    it('rejects ready below 0.8 confidence', () => {
      const advice = makeAdvice({
        state: 'ready',
        aimPoint: { x: 0.5, y: 0.5 },
        readyToShoot: true,
        confidence: 0.7,
        route: { path: 'none', holdMs: 800 },
      });
      expect(() => parseGuidanceProtocol(json(advice))).toThrow(/ready/);
    });

    it('rejects ready with a pending camera parameter', () => {
      const advice = makeAdvice({
        state: 'ready',
        aimPoint: { x: 0.5, y: 0.5 },
        readyToShoot: true,
        confidence: 0.9,
        route: { path: 'none', holdMs: 800 },
        camera: { zoomFactor: null, flash: 'on', aperture: null, contrast: null, whiteBalance: 'keep' },
      });
      expect(() => parseGuidanceProtocol(json(advice))).toThrow(/ready/);
    });
  });

  describe('uncertain state', () => {
    it('accepts low-confidence uncertain with everything on hold', () => {
      const advice = makeAdvice({
        state: 'uncertain',
        summary: '光线变化太快，难以判断',
        confidence: 0.4,
        aimPoint: null,
        route: { path: 'none', holdMs: 800 },
      });
      expect(parseGuidanceProtocol(json(advice)).state).toBe('uncertain');
    });

    it('rejects uncertain with confidence 0.6 or above', () => {
      const advice = makeAdvice({
        state: 'uncertain',
        confidence: 0.6,
        aimPoint: null,
        route: { path: 'none', holdMs: 800 },
      });
      expect(() => parseGuidanceProtocol(json(advice))).toThrow(/uncertain/);
    });

    it('rejects uncertain when an action is not hold', () => {
      const advice = makeAdvice({
        state: 'uncertain',
        confidence: 0.4,
        aimPoint: null,
        horizontal: 'left',
        route: { path: 'none', holdMs: 800 },
      });
      expect(() => parseGuidanceProtocol(json(advice))).toThrow(/uncertain/);
    });

    it('rejects uncertain with readyToShoot true', () => {
      const advice = makeAdvice({
        state: 'uncertain',
        confidence: 0.4,
        aimPoint: null,
        readyToShoot: true,
        route: { path: 'none', holdMs: 800 },
      });
      expect(() => parseGuidanceProtocol(json(advice))).toThrow(/uncertain/);
    });
  });

  it('rejects a low-confidence non-uncertain advice', () => {
    const advice = makeAdvice({ confidence: 0.5 });
    expect(() => parseGuidanceProtocol(json(advice))).toThrow(/uncertain/);
  });

  it('rejects zoom paired with a physical movement', () => {
    const advice = makeAdvice({
      state: 'adjust',
      aimPoint: null,
      horizontal: 'left',
      zoom: 'in',
      route: { path: 'none', holdMs: 800 },
      camera: { zoomFactor: null, flash: 'keep', aperture: null, contrast: null, whiteBalance: 'keep' },
    });
    (advice.camera as { zoomFactor: number | null }).zoomFactor = 1.2;
    expect(() => parseGuidanceProtocol(json(advice))).toThrow(/变焦/);
  });

  it('rejects a zoom action without a zoomFactor', () => {
    const advice = makeAdvice({
      state: 'adjust',
      aimPoint: null,
      zoom: 'in',
      route: { path: 'none', holdMs: 800 },
    });
    expect(() => parseGuidanceProtocol(json(advice))).toThrow(/zoomFactor/);
  });

  it('rejects a camera parameter plan with confidence below 0.8', () => {
    const advice = makeAdvice({
      state: 'adjust',
      aimPoint: null,
      confidence: 0.7,
      route: { path: 'none', holdMs: 800 },
      camera: { zoomFactor: null, flash: 'on', aperture: null, contrast: null, whiteBalance: 'keep' },
    });
    expect(() => parseGuidanceProtocol(json(advice))).toThrow(/0\.8/);
  });

  it('rejects a route path that does not match the state', () => {
    const advice = makeAdvice({ route: { path: 'none', holdMs: 800 } });
    expect(() => parseGuidanceProtocol(json(advice))).toThrow(/路线/);
  });

  it('rejects an out-of-range aimPoint coordinate', () => {
    const advice = makeAdvice({ aimPoint: { x: 1.2, y: 0.5 } });
    expect(() => parseGuidanceProtocol(json(advice))).toThrow(/坐标不合法/);
  });

  it('rejects a summary longer than 36 characters', () => {
    const advice = makeAdvice({ summary: 'x'.repeat(37) });
    expect(() => parseGuidanceProtocol(json(advice))).toThrow(/长度/);
  });
});
