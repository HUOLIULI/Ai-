import type { PluginRegistry } from '../registry';
import { pluginRegistry } from '../registry';
import { MODE_PLUGINS } from './modes';
import { STYLE_PLUGINS } from './styles';
import { LUTS } from './lut';
import { styleFilter, jsFilterBackend } from './filters';
import { canvasFilterBackend } from './canvasBackend';
import { defaultFilterBackend } from './defaultBackend';
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

export { jsFilterBackend, canvasFilterBackend, defaultFilterBackend };

// Applies the active style's LUT filter to a captured photo uri. Looks the
// filter up from the registry so a third-party override wins, and renders
// through the platform-adaptive backend (native bitmap on Android, canvas on
// web). Fails open: if the filter or backend is unavailable the original uri
// is returned, so capture never blocks on the filter.
export async function applyStyleFilterToPhoto(uri: string, style: CameraStyle): Promise<string> {
  const filter = pluginRegistry.filter(`filter-${style}`);
  if (!filter) return uri;
  try {
    return await filter.apply(defaultFilterBackend(), uri);
  } catch {
    return uri;
  }
}

