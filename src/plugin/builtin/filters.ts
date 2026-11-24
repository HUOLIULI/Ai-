import { LUTS } from './lut';
import { applyLutToImageUri } from './canvasBackend';
import type { FilterBackend, FilterPlugin, LutSpec } from '../types';
import type { CameraStyle } from '../../types/guidance';

// Re-exported for consumers that import pixel math from the filters module.
export { applyLutToImageData } from './lutMath';

export const jsFilterBackend: FilterBackend = {
  kind: 'js',
  name: 'js-lut',
  available: () => true,
};

// A style filter plugin. The backend decides whether the work happens in JS
// or on the GPU. For the JS backend the input uri is loaded into a canvas,
// the LUT is applied pixel-by-pixel, and a new data URL is written. When the
// backend is unavailable (native, or Web without canvas) the input uri is
// returned unchanged so capture still succeeds.
export function styleFilter(style: CameraStyle): FilterPlugin {
  const lut = LUTS[style];
  return lutFilter(lut);
}

// A filter plugin driven by an arbitrary LutSpec. Powers both the built-in
// style filters and the AI color grade, which compiles model output into a
// LutSpec at runtime.
export function lutFilter(lut: LutSpec): FilterPlugin {
  return {
    id: `filter-${lut.name}`,
    apply: async (backend, uri) => {
      if (!backend.available()) return uri;
      if (backend.kind === 'js') {
        return applyLutToImageUri(uri, lut);
      }
      // GPU backend: hand off to the native module.
      return uri;
    },
  };
}

// Applies any LutSpec to a photo uri through the given backend. Fails open:
// an unavailable backend or a thrown error returns the original uri so capture
// never blocks on the filter.
export async function applyLutSpecToPhoto(uri: string, lut: LutSpec, backend: FilterBackend = jsFilterBackend): Promise<string> {
  try {
    return await lutFilter(lut).apply(backend, uri);
  } catch {
    return uri;
  }
}
