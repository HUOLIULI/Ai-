import { PluginRegistry } from '../registry';
import type { ModePlugin, StylePlugin, FilterPlugin, DetectorPlugin } from '../types';

function modePlugin(id: string, prompt = '测试模式'): ModePlugin {
  return { id, label: id, prompt };
}
function stylePlugin(id: StylePlugin['id']): StylePlugin {
  return {
    id, label: id, description: '',
    preset: { whiteBalance: 'auto', contrast: null },
    lut: { name: `${id}-lut`, matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1] },
  };
}

describe('PluginRegistry', () => {
  it('returns empty lists before any registration', () => {
    const reg = new PluginRegistry();
    expect(reg.modes()).toEqual([]);
    expect(reg.styles()).toEqual([]);
    expect(reg.detectors()).toEqual([]);
    expect(reg.filter('missing')).toBeNull();
  });

  it('registers a plugin and exposes its capabilities', () => {
    const reg = new PluginRegistry();
    const filter: FilterPlugin = { id: 'f', apply: async (b, uri) => uri };
    const detector: DetectorPlugin = { id: 'd', detect: async () => null };
    reg.register({
      id: 'test',
      modes: [modePlugin('人像')],
      styles: [stylePlugin('清透')],
      filters: [filter],
      detectors: [detector],
    });
    expect(reg.modes().map(m => m.id)).toEqual(['人像']);
    expect(reg.styles().map(s => s.id)).toEqual(['清透']);
    expect(reg.filter('f')).toBe(filter);
    expect(reg.detectors().map(d => d.id)).toEqual(['d']);
  });

  it('later registration overrides earlier entries with the same id', () => {
    const reg = new PluginRegistry();
    reg.register({ id: 'p', modes: [modePlugin('人像', '第一版')] });
    reg.register({ id: 'p', modes: [modePlugin('人像', '第二版')] });
    const modes = reg.modes();
    expect(modes).toHaveLength(1);
    expect(modes[0].prompt).toBe('第二版');
  });

  it('resets to empty', () => {
    const reg = new PluginRegistry();
    reg.register({ id: 'p', modes: [modePlugin('m')] });
    reg.reset();
    expect(reg.modes()).toEqual([]);
  });
});
