import type { LutSpec } from '../types';

// Pure LUT pixel math, no DOM or native deps. Shared by the Web canvas backend
// and any future native base64 reader.
export function applyLutToImageData(frame: ImageData, lut: LutSpec): ImageData {
  const out = new Uint8ClampedArray(frame.data.length);
  const m = lut.matrix;
  const curve = lut.curve;
  const temperature = lut.temperature ?? 0;
  const grain = lut.grain ?? 0;

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
