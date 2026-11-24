import type { PluginRegistry } from '../registry';
import { MODE_PLUGINS } from './modes';
import { STYLE_PLUGINS } from './styles';
import { LUTS } from './lut';
import { styleFilter } from './filters';
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
  });
}
