import { GuidanceExecution } from '../guidanceExecution';
import type { Guidance, GuidanceContext, GuidanceResult } from '../../types/guidance';

const context: GuidanceContext = {
  style: '清透', mode: '人像', facing: 'back', zoom: 0, flash: 'off',
  capabilities: { native: true, cameraId: 'back', apertures: [], contrast: true, whiteBalance: ['auto', 'daylight'] },
};

function makeAdvice(overrides: Partial<Guidance> = {}): Guidance {
  return {
    version: 3,
    state: 'aim',
    summary: '稍向右移动手机',
    horizontal: 'hold', vertical: 'hold', tilt: 'hold', distance: 'hold', zoom: 'hold',
    light: '保持当前光线',
    confidence: 0.9,
    aimPoint: { x: 0.6, y: 0.45 },
    readyToShoot: false,
    route: { path: 'straight', holdMs: 800 },
    camera: { zoomFactor: null, flash: 'keep', aperture: null, contrast: null, whiteBalance: 'keep' },
    ...overrides,
  };
}
const result = (advice: Guidance, capturedAt = 0): GuidanceResult => ({ advice, capturedAt, receivedAt: 100 });

describe('GuidanceExecution', () => {
  it('reports idle before a plan loads', () => {
    const executor = new GuidanceExecution();
    expect(executor.phase).toBe('idle');
  });

  it('rejects a front-camera plan that turns the flash on', () => {
    const executor = new GuidanceExecution();
    const front: GuidanceContext = { ...context, facing: 'front', flash: 'off' };
    const advice = makeAdvice({ state: 'adjust', aimPoint: null, route: { path: 'none', holdMs: 800 },
      camera: { zoomFactor: null, flash: 'on', aperture: null, contrast: null, whiteBalance: 'keep' } });
    expect(() => executor.load(result(advice), front, 0, true)).toThrow(/前置/);
  });

  it('rejects a zoom step larger than 0.3 from the current factor', () => {
    const executor = new GuidanceExecution();
    const advice = makeAdvice({ state: 'adjust', aimPoint: null, zoom: 'in', route: { path: 'none', holdMs: 800 },
      camera: { zoomFactor: 1.8, flash: 'keep', aperture: null, contrast: null, whiteBalance: 'keep' } });
    // zoom 0 => factor 1.0; step to 1.8 exceeds 0.3.
    expect(() => executor.load(result(advice), context, 0, true)).toThrow(/0\.3/);
  });

  it('rejects a zoom direction that contradicts the target factor', () => {
    const executor = new GuidanceExecution();
    // zoom 0.2 => factor 1.6; "in" with target 1.4 is within 0.3 but backwards.
    const advice = makeAdvice({ state: 'adjust', aimPoint: null, zoom: 'in', route: { path: 'none', holdMs: 800 },
      camera: { zoomFactor: 1.4, flash: 'keep', aperture: null, contrast: null, whiteBalance: 'keep' } });
    expect(() => executor.load(result(advice), { ...context, zoom: 0.2 }, 0, true)).toThrow(/矛盾/);
  });

  it('commands zoom only when autoZoom is on and the factor moves', () => {
    const executor = new GuidanceExecution();
    const advice = makeAdvice({ state: 'adjust', aimPoint: null, zoom: 'in', route: { path: 'none', holdMs: 800 },
      camera: { zoomFactor: 1.3, flash: 'keep', aperture: null, contrast: null, whiteBalance: 'keep' } });
    expect(executor.load(result(advice), context, 0, false)).toEqual({});
    const commands = executor.load(result(advice), context, 0, true);
    expect(commands.zoom).toBeCloseTo(0.3 / 3, 10);
  });

  it('reaches ready after settling for the hold duration', () => {
    const executor = new GuidanceExecution();
    const advice = makeAdvice();
    executor.setSensors(true);
    executor.load(result(advice), context, 0, true);
    expect(executor.phase).toBe('moving');
    // Align the target locally, then let it settle.
    executor.target = { x: 0.5, y: 0.5, phase: 'verifying' };
    executor.beginSettling(1000);
    expect(executor.finishIfStable(1801)).toBe(true);
    expect(executor.phase).toBe('ready');
  });

  it('does not finish before the hold duration elapses', () => {
    const executor = new GuidanceExecution();
    executor.setSensors(true);
    executor.load(result(makeAdvice()), context, 0, true);
    executor.target = { x: 0.5, y: 0.5, phase: 'verifying' };
    executor.beginSettling(1000);
    expect(executor.finishIfStable(1300)).toBe(false);
    expect(executor.phase).toBe('settling');
  });

  it('revokes ready when motion is detected', () => {
    const executor = new GuidanceExecution();
    executor.setSensors(true);
    executor.load(result(makeAdvice()), context, 0, true);
    executor.target = { x: 0.5, y: 0.5, phase: 'verifying' };
    executor.beginSettling(0);
    expect(executor.finishIfStable(1000)).toBe(true);
    expect(executor.phase).toBe('ready');
    executor.noteMotion(2000);
    expect(executor.phase).toBe('settling');
  });

  it('keeps ready through a small tremor that stays aligned', () => {
    const executor = new GuidanceExecution();
    executor.setSensors(true);
    executor.load(result(makeAdvice()), context, 0, true);
    executor.target = { x: 0.5, y: 0.5, phase: 'verifying' };
    executor.beginSettling(0);
    expect(executor.finishIfStable(1000)).toBe(true);
    executor.rotate({ x: 0, y: 0.001, z: 0 }, 0.05, 'back', 1100);
    expect(executor.phase).toBe('ready');
  });

  it('requires manual confirmation for physical movements without sensors', () => {
    const executor = new GuidanceExecution();
    executor.setSensors(false);
    const advice = makeAdvice({ distance: 'closer', state: 'adjust', aimPoint: null,
      route: { path: 'none', holdMs: 800 } });
    executor.load(result(advice), context, 0, true);
    expect(executor.phase).toBe('manual');
    expect(executor.confirmManual(5000)).toBe(true);
    expect(executor.phase).toBe('settling');
  });

  it('refuses manual confirmation for uncertain plans', () => {
    const executor = new GuidanceExecution();
    executor.setSensors(false);
    const advice = makeAdvice({ state: 'uncertain', confidence: 0.4, aimPoint: null,
      route: { path: 'none', holdMs: 800 } });
    executor.load(result(advice), context, 0, true);
    expect(executor.phase).toBe('unavailable');
    expect(executor.confirmManual(5000)).toBe(false);
  });

  it('stays in parameters until hardware settings complete', () => {
    const executor = new GuidanceExecution();
    executor.setSensors(true);
    const advice = makeAdvice({ state: 'adjust', aimPoint: null, route: { path: 'none', holdMs: 800 },
      camera: { zoomFactor: null, flash: 'keep', aperture: null, contrast: 1.1, whiteBalance: 'daylight' } });
    executor.load(result(advice), context, 0, true);
    executor.setHardwareDone(false, 0);
    expect(executor.phase).toBe('parameters');
    executor.setHardwareDone(true, 100);
    expect(executor.phase).toBe('settling');
  });

  it('rescales the target when the user zooms manually', () => {
    const executor = new GuidanceExecution();
    executor.setSensors(true);
    const advice = makeAdvice({ aimPoint: { x: 0.7, y: 0.5 } });
    executor.load(result(advice), context, 0, true);
    const before = executor.target!;
    expect(before.x).toBeCloseTo(0.7);
    executor.observeCamera({ ...context, zoom: 1 }, 1000); // zoom -> 4.0x, factor x4
    // Target is reprojected toward center: 0.5 + (0.7-0.5)*4/1... clamp-free math check
    expect(executor.target!.x).toBeCloseTo(0.5 + (0.7 - 0.5) * 4);
  });
});
