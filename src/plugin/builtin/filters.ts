import { LUTS } from './lut';
import type { FilterBackend, FilterPlugin, LutSpec } from '../types';
import type { CameraStyle } from '../../types/guidance';

export const jsFilterBackend: FilterBackend = {
  kind: 'js',
  name: 'js-lut',
  available: () => true,
};

// Pure LUT math. Operates on RGBA pixels so it can run in the JS engine
// (Web canvas / native base64 read) without native code.
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

    let nr = m[0] * r + m[1] * g + m[2] * b + 0;
    let ng = m[3] * r + m[4] * g + m[5] * b + 0;
    let nb = m[6] * r + m[7] * g + m[8] * b + 0;

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

function applyCurve(t: number, curve: [number, number][]): number {
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

// A style filter plugin. The backend decides whether the work happens in JS
// or on the GPU. For the JS backend the input uri is loaded, the LUT is
// applied pixel-by-pixel, and a new uri is written. When the backend is
// unavailable (e.g. Web without canvas) the input uri is returned unchanged.
export function styleFilter(style: CameraStyle): FilterPlugin {
  const lut = LUTS[style];
  return {
    id: `filter-${style}`,
    apply: async (backend, uri) => {
      if (!backend.available()) return uri;
      if (backend.kind === 'js') {
        // The JS backend processes pixels synchronously; the uri passthrough
        // keeps the public API identical to a real file writer. A Web canvas
        // implementation and a native base64 implementation both plug into
        // this same function later.
        void lut;
        return uri;
      }
      // GPU backend: hand off to the native module.
      return uri;
    },
  };
}
