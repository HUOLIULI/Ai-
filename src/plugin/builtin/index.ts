import type { PluginRegistry } from '../registry';
import { MODE_PLUGINS } from './modes';
import { STYLE_PLUGINS } from './styles';
import { LUTS } from './lut';
import { styleFilter, jsFilterBackend } from './filters';
import { sceneChangeDetector } from './detectors/sceneChange';
import { lightingDetector } from './detectors/lighting';
import { faceBoxDetector } from './detectors/faceBox';
import type { CameraStyle } from '../../types/guidance';

// Registers all built-in capability plugins. The host calls this once at
// startup; third-party plugins register alongside, and same-id entries
// later in the registry win.
export function registerBuiltinPlugins(registry: PluginRegistry): void {
  registry.register({
    id: 'drama-builtin',
    modes: MODE_PLUGINS,
    styles: STYLE_PLUGINS,
    filters: (Object.keys(LUTS) as CameraStyle[]).map(name => styleFilter(name)),
    detectors: [
      faceBoxDetector(),
      // sceneChange needs a previous frame; the host supplies it via the
      // closure when wiring the detector into the guidance loop.
      sceneChangeDetector(null),
      lightingDetector(),
    ],
  });
}

export { jsFilterBackend };

