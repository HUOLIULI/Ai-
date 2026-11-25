import { TARGET_TOLERANCE, isTargetAligned, moveCompositionTarget, targetFromResult } from '../compositionTarget';
import type { GuidanceResult } from '../../types/guidance';

function makeResult(overrides: {
  state?: 'aim' | 'ready';
  capturedAt?: number;
  x?: number;
  y?: number;
  confidence?: number;
  horizontal?: 'left' | 'right' | 'hold';
  readyToShoot?: boolean;
} = {}): GuidanceResult {
  const { state = 'aim', capturedAt = 0, x = 0.5, y = 0.5, confidence = 0.9, horizontal = 'hold', readyToShoot = false } = overrides;
  return {
    advice: {
      version: 3, state,
      summary: '保持构图',
      horizontal, vertical: 'hold', tilt: 'hold', distance: 'hold', zoom: 'hold',
      light: '光线良好', confidence,
      aimPoint: { x, y }, readyToShoot,
      route: { path: state === 'aim' ? 'straight' : 'none', holdMs: 800 },
      camera: { zoomFactor: null, flash: 'keep', aperture: null, contrast: null, whiteBalance: 'keep' },
    },
    capturedAt,
    receivedAt: 50,
  };
}

describe('isTargetAligned', () => {
  it('accepts points within tolerance', () => {
    expect(isTargetAligned(0.5, 0.5)).toBe(true);
    expect(isTargetAligned(0.5 + TARGET_TOLERANCE - 1e-9, 0.5)).toBe(true);
    expect(isTargetAligned(0.5, 0.5 + (TARGET_TOLERANCE * 3 / 4 - 1e-9))).toBe(true);
  });

  it('rejects points outside tolerance', () => {
    expect(isTargetAligned(0.5 + TARGET_TOLERANCE, 0.5)).toBe(false);
    expect(isTargetAligned(0.5, 0.5 + TARGET_TOLERANCE * 3 / 4 + 1e-9)).toBe(false);
  });

  it('treats vertical distance as 4/3 scaled horizontal units on a 3:4 preview', () => {
    // Horizontal tolerance 0.035 corresponds to vertical 0.02625.
    expect(isTargetAligned(0.5, 0.5 + 0.0262)).toBe(true);
    expect(isTargetAligned(0.5, 0.5 + 0.03)).toBe(false);
  });
});

describe('targetFromResult', () => {
  it('returns aiming for a fresh, unaligned aim', () => {
    const target = targetFromResult(makeResult({ x: 0.8, y: 0.4 }), 100)!;
    expect(target).toEqual({ x: 0.8, y: 0.4, phase: 'aiming' });
  });

  it('returns verifying for a fresh, aligned aim', () => {
    expect(targetFromResult(makeResult({ x: 0.5, y: 0.5 }), 100)).toEqual({ x: 0.5, y: 0.5, phase: 'verifying' });
  });

  it('returns ready only for aligned ready advice with high confidence', () => {
    expect(targetFromResult(makeResult({ state: 'ready', readyToShoot: true, confidence: 0.9 }), 100))
      .toEqual({ x: 0.5, y: 0.5, phase: 'ready' });
    expect(targetFromResult(makeResult({ state: 'ready', readyToShoot: true, confidence: 0.7 }), 100))
      .toEqual({ x: 0.5, y: 0.5, phase: 'verifying' });
  });

  it('returns null for a stale sample', () => {
    expect(targetFromResult(makeResult({ capturedAt: 0 }), 61_000)).toBeNull();
  });

  it('returns null when any physical action is pending', () => {
    expect(targetFromResult(makeResult({ horizontal: 'left' }), 100)).toBeNull();
  });

  it('returns null for low-confidence advice', () => {
    expect(targetFromResult(makeResult({ confidence: 0.5 }), 100)).toBeNull();
  });
});

describe('moveCompositionTarget', () => {
  const target = { x: 0.5, y: 0.5, phase: 'aiming' as const };

  it('ignores hand tremor below threshold', () => {
    expect(moveCompositionTarget(target, { x: 0.01, y: 0.01, z: 0.01 }, 0.05, 'back', 1)).toBe(target);
  });

  it('rejects non-finite or out-of-window dt', () => {
    expect(moveCompositionTarget(target, { x: 0.1, y: 0.1, z: 0 }, 0, 'back', 1)).toBe(target);
    expect(moveCompositionTarget(target, { x: 0.1, y: 0.1, z: 0 }, 0.3, 'back', 1)).toBe(target);
    expect(moveCompositionTarget(target, { x: NaN, y: 0.1, z: 0 }, 0.05, 'back', 1)).toBe(target);
  });

  it('moves the target with yaw and pitch, clamped to bounds', () => {
    const moved = moveCompositionTarget({ x: 1.4, y: 0.5, phase: 'aiming' }, { x: 0, y: 0.5, z: 0 }, 0.1, 'back', 1);
    expect(moved.x).toBeLessThanOrEqual(1.5);
    expect(moved.x).toBeGreaterThan(1.4);
  });

  it('reverses pitch for the front camera', () => {
    const back = moveCompositionTarget(target, { x: 0.1, y: 0, z: 0 }, 0.1, 'back', 1);
    const front = moveCompositionTarget(target, { x: 0.1, y: 0, z: 0 }, 0.1, 'front', 1);
    expect(front.y).toBeLessThan(0.5);
    expect(back.y).toBeGreaterThan(0.5);
  });

  it('scales gain with the digital zoom factor', () => {
    const at1x = moveCompositionTarget(target, { x: 0, y: 0.2, z: 0 }, 0.1, 'back', 1);
    const at4x = moveCompositionTarget(target, { x: 0, y: 0.2, z: 0 }, 0.1, 'back', 4);
    expect(at4x.x - 0.5).toBeCloseTo((at1x.x - 0.5) * 4, 10);
  });
});
