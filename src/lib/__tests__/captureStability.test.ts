import { waitForStability, STABLE_SHAKE, STABILITY_WAIT_MS } from '../captureStability';

describe('waitForStability', () => {
  it('resolves immediately when the hand is already steady', async () => {
    await expect(waitForStability(() => STABLE_SHAKE, () => true, () => false)).resolves.toBeUndefined();
  });

  it('resolves once the hand settles before the deadline', async () => {
    let calls = 0;
    const shake = () => (calls++ < 2 ? STABLE_SHAKE + 1 : STABLE_SHAKE);
    await expect(waitForStability(shake, () => true, () => false)).resolves.toBeUndefined();
  });

  it('gives up once the deadline passes even if the hand never settles', async () => {
    let ticks = 0;
    const shouldContinue = () => ++ticks <= 3;
    await expect(waitForStability(() => STABLE_SHAKE + 1, shouldContinue, () => false)).resolves.toBeUndefined();
    expect(ticks).toBe(4);
  });

  it('aborts as soon as capture is cancelled', async () => {
    let ticks = 0;
    const shouldContinue = () => ++ticks <= 5;
    const cancelled = () => ticks >= 2;
    await expect(waitForStability(() => STABLE_SHAKE + 1, shouldContinue, cancelled)).resolves.toBeUndefined();
    expect(ticks).toBe(2);
  });

  it('exposes the bounded wait so a restless hand is never blocked', () => {
    expect(STABILITY_WAIT_MS).toBeGreaterThan(0);
    expect(STABILITY_WAIT_MS).toBeLessThan(5000);
  });
});
