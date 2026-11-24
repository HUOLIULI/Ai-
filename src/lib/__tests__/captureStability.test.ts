import { isShakeStable, STABLE_SHAKE, STABILITY_WAIT_MS } from '../captureStability';

describe('captureStability gate', () => {
  it('treats a shake at or below the threshold as stable', () => {
    expect(isShakeStable(0)).toBe(true);
    expect(isShakeStable(STABLE_SHAKE)).toBe(true);
    expect(isShakeStable(0.2)).toBe(true);
  });

  it('treats a shake above the threshold as unstable', () => {
    expect(isShakeStable(STABLE_SHAKE + 0.01)).toBe(false);
    expect(isShakeStable(2)).toBe(false);
  });

  it('never blocks on unknown or invalid readings', () => {
    expect(isShakeStable(null)).toBe(true);
    expect(isShakeStable(Number.NaN)).toBe(true);
  });

  it('exposes a bounded wait so capture never hangs', () => {
    expect(STABILITY_WAIT_MS).toBeGreaterThan(0);
    expect(Number.isFinite(STABILITY_WAIT_MS)).toBe(true);
  });
});
