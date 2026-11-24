import { PluginRegistry } from '../../registry';
import { registerBuiltinPlugins } from '../index';
import { MODE_PLUGINS } from '../modes';
import { STYLE_PLUGINS } from '../styles';
import type { CameraMode, CameraStyle } from '../../../types/guidance';

const ALL_MODES: CameraMode[] = ['人像', '风景', '夜景'];
const ALL_STYLES: CameraStyle[] = ['清透', '奶杏', '薄荷', '胶片'];

describe('builtin plugins', () => {
  it('registers 3 modes and 4 styles', () => {
    const reg = new PluginRegistry();
    registerBuiltinPlugins(reg);
    expect(reg.modes()).toHaveLength(ALL_MODES.length);
    expect(reg.styles()).toHaveLength(ALL_STYLES.length);
  });

  it('exposes every declared camera mode as a plugin', () => {
    const reg = new PluginRegistry();
    registerBuiltinPlugins(reg);
    expect(MODE_PLUGINS.map(p => p.id)).toEqual(ALL_MODES);
    expect(STYLE_PLUGINS.map(p => p.id)).toEqual(ALL_STYLES);
  });

  it('keeps the original portrait prompt content', () => {
    const reg = new PluginRegistry();
    registerBuiltinPlugins(reg);
    const portrait = reg.mode('人像');
    expect(portrait).not.toBeNull();
    expect(portrait!.prompt).toContain('人物');
    expect(portrait!.prompt).toContain('构图');
  });

  it('styles carry a non-trivial LUT matrix', () => {
    for (const style of STYLE_PLUGINS) {
      expect(style.lut.matrix).toHaveLength(9);
      expect(style.lut.name).toBe(`${style.id}`);
    }
  });

  it('mode prompts are non-empty', () => {
    for (const mode of MODE_PLUGINS) {
      expect(mode.prompt.trim().length).toBeGreaterThan(50);
    }
  });
});
