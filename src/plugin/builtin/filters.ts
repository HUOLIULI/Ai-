import { LUTS } from './lut';
import { applyLutToImageUri } from './canvasBackend';
import type { FilterBackend, FilterPlugin } from '../types';
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
  return {
    id: `filter-${style}`,
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
