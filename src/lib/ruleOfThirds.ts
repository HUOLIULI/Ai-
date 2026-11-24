// Pure rule-of-thirds composition helpers. Given an AI aimPoint in normalized
// preview coordinates (0..1, portrait), snap it to the nearest third-grid
// intersection and describe the small adjustment that brings the subject onto
// that point. No DOM, native, or network deps so it stays testable and offline.

const THIRDS_X = [1 / 3, 2 / 3];
const THIRDS_Y = [1 / 3, 2 / 3];

// Reference width used to express the normalized offset as a tangible pixel
// count for the UI hint. Portrait previews render around this width.
const REFERENCE_WIDTH_PX = 1080;

export type ThirdPoint = { x: number; y: number };

export type ThirdsAdjustment = {
  nearest: ThirdPoint | null;
  horizontal: 'left' | 'right' | 'hold';
  vertical: 'up' | 'down' | 'hold';
  offsetPx: number;
};

export function nearestThirdPoint(x: number, y: number): ThirdPoint | null {
  if (![x, y].every(n => Number.isFinite(n))) return null;
  // The 4/3 vertical scale is a constant, so it does not change which grid line
  // is nearest on each axis. Pick the nearest x line and y line independently;
  // their intersection is the nearest grid corner.
  const nearestX = THIRDS_X.reduce((a, b) => (Math.abs(x - b) < Math.abs(x - a) ? b : a));
  const nearestY = THIRDS_Y.reduce((a, b) => (Math.abs(y - b) < Math.abs(y - a) ? b : a));
  return { x: nearestX, y: nearestY };
}

export function thirdsAdjustment(x: number, y: number): ThirdsAdjustment {
  const nearest = nearestThirdPoint(x, y);
  if (!nearest) return { nearest: null, horizontal: 'hold', vertical: 'hold', offsetPx: 0 };
  const dx = nearest.x - x;
  const dy = (nearest.y - y) * 4 / 3;
  const offsetPx = Math.round(Math.hypot(dx, dy) * REFERENCE_WIDTH_PX);
  const horizontal = Math.abs(dx) < 0.01 ? 'hold' : dx > 0 ? 'right' : 'left';
  const vertical = Math.abs(dy) < 0.01 ? 'hold' : dy > 0 ? 'down' : 'up';
  return { nearest, horizontal, vertical, offsetPx };
}
