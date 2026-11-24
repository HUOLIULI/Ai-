import type { LutSpec } from '../types';

// Radial vignette falloff. nx/ny are the pixel's normalized offset from the
// image center (-1..1 on each axis); amount is the vignette strength 0..1.
// Returns the multiplicative brightness factor: 1 at the center (unchanged),
// dipping toward (1 - amount) at the corners. amount<=0 always returns 1 so a
// disabled vignette is a true no-op.
export function vignetteFactor(nx: number, ny: number, amount: number): number {
  if (!(amount > 0)) return 1;
  const dist = Math.min(1, Math.sqrt(nx * nx + ny * ny) / Math.SQRT2);
  return 1 - amount * dist * dist;
}

export function applyLutToImageData(frame: ImageData, lut: LutSpec): ImageData {
  const out = new Uint8ClampedArray(frame.data.length);
  const m = lut.matrix;
  const curve = lut.curve;
  const temperature = lut.temperature ?? 0;
  const grain = lut.grain ?? 0;
  const vignette = lut.vignette ?? 0;

  for (let i = 0; i < frame.data.length; i += 4) {
    const r = frame.data[i];
    const g = frame.data[i + 1];
    const b = frame.data[i + 2];
    const a = frame.data[i + 3];

    let nr = m[0] * r + m[1] * g + m[2] * b;
    let ng = m[3] * r + m[4] * g + m[5] * b;
    let nb = m[6] * r + m[7] * g + m[8] * b;

    // Temperature shift: warm = +R, -B; cool = -R, +B.
    const temp = temperature / 255;
    nr += temp * 40;
    nb -= temp * 40;

    // Curve: piecewise-linear over the control points.
    if (curve && curve.length >= 2) {
      nr = applyCurve(nr / 255, curve) * 255;
      ng = applyCurve(ng / 255, curve) * 255;
      nb = applyCurve(nb / 255, curve) * 255;
    }

    // Grain: deterministic per-pixel hash so the same frame gets the same
    // grain and re-renders do not flicker.
    if (grain > 0) {
      const x = (i / 4) % frame.width;
      const y = Math.floor((i / 4) / frame.width);
      const h = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      const noise = h - Math.floor(h); // 0..1
      const amount = grain * 40;
      nr += (noise - 0.5) * amount;
      ng += (noise - 0.5) * amount;
      nb += (noise - 0.5) * amount;
    }

    // Vignette: multiplicative radial falloff toward the corners, applied to
    // all three channels equally so the hue is preserved while edges darken.
    if (vignette > 0) {
      const px = (i / 4) % frame.width;
      const py = Math.floor((i / 4) / frame.width);
      const nx = frame.width > 1 ? (px / (frame.width - 1)) * 2 - 1 : 0;
      const ny = frame.height > 1 ? (py / (frame.height - 1)) * 2 - 1 : 0;
      const factor = vignetteFactor(nx, ny, vignette);
      nr *= factor;
      ng *= factor;
      nb *= factor;
    }

    out[i] = nr;
    out[i + 1] = ng;
    out[i + 2] = nb;
    out[i + 3] = a;
  }
  return { width: frame.width, height: frame.height, data: out } as unknown as ImageData;
}

export function applyCurve(t: number, curve: [number, number][]): number {
  if (t <= curve[0][0]) return curve[0][1];
  for (let i = 1; i < curve.length; i++) {
    if (t <= curve[i][0]) {
      const [x0, y0] = curve[i - 1];
      const [x1, y1] = curve[i];
      const f = (t - x0) / (x1 - x0);
      return y0 + f * (y1 - y0);
    }
  }
  const last = curve[curve.length - 1];
  return last[1];
}
