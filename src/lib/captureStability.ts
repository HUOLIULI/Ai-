// Stability gate for the shutter: blur is the top cause of ruined point-and-shoot
// photos. When the offline decision flags the device as shaky, capture can wait
// briefly for the gyroscope to settle before firing. The wait is bounded so a
// restless hand never blocks the shot — after the deadline it captures anyway.

// Gyro magnitude at or below this is considered steady. Well under the
// SHAKY_SHAKE threshold used to flag instability, so the gate only holds for a
// genuinely restless device.
export const STABLE_SHAKE = 0.4;

// Upper bound on how long capture waits for the hand to settle. A restless
// hand captures anyway after this, so the shutter never hangs.
export const STABILITY_WAIT_MS = 1200;

// A reading at/below the threshold is stable. Unknown or invalid readings are
// treated as stable so a missing gyroscope never blocks capture.
export function isShakeStable(shake: number | null, threshold: number = STABLE_SHAKE): boolean {
  if (shake === null || !Number.isFinite(shake)) return true;
  return shake <= threshold;
}

// Poll for a steady hand until it settles, the deadline passes, or capture is
// cancelled — whichever comes first. Pure control flow: the shake source, the
// deadline check, and the cancel check are injected so the loop is testable.
export async function waitForStability(
  getShake: () => number | null,
  withinDeadline: () => boolean,
  cancelled: () => boolean,
): Promise<void> {
  while (withinDeadline() && !cancelled() && !isShakeStable(getShake())) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}
