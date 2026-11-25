import withDramaNative from '../withDramaNative';
import { REQUEST_INSTALL_PACKAGES } from '../permissions';
import { MLKIT_FACE_DEPENDENCY } from '../gradle';
import type { AndroidManifest } from '@expo/config-plugins/build/android/Manifest';

type ConfigWithMods = { mods?: { android?: { manifest?: unknown; appBuildGradle?: unknown } } };

// Runs a registered mod against a synthetic modResults and closes the chain
// with an identity nextMod, so the pure transform is observed directly.
async function runMod(mod: unknown, modResults: unknown): Promise<{ modResults: unknown }> {
  const action = mod as (ctx: unknown) => Promise<{ modResults: unknown }>;
  return action({ modRequest: { nextMod: (result: unknown) => result }, modResults });
}

function emptyManifest(): AndroidManifest {
  return { manifest: { $: { 'xmlns:android': 'http://schemas.android.com/apk/res/android' }, queries: [] } };
}

function apply(): ConfigWithMods {
  return withDramaNative({ name: 'Drama', slug: 'warm-lens' }, {}) as unknown as ConfigWithMods;
}

describe('withDramaNative wiring', () => {
  it('registers android manifest and appBuildGradle mods', () => {
    const config = apply();
    expect(typeof config.mods?.android?.manifest).toBe('function');
    expect(typeof config.mods?.android?.appBuildGradle).toBe('function');
  });

  it('manifest mod merges the install-packages permission', async () => {
    const config = apply();
    const result = await runMod(config.mods?.android?.manifest, emptyManifest());
    const manifest = result.modResults as AndroidManifest;
    const names = (manifest.manifest['uses-permission'] ?? []).map((entry) => entry.$['android:name']);
    expect(names).toContain(REQUEST_INSTALL_PACKAGES);
  });

  it('appBuildGradle mod injects the MLKit dependency', async () => {
    const config = apply();
    const result = await runMod(config.mods?.android?.appBuildGradle, {
      contents: 'apply plugin: "com.android.application"\n',
      path: 'android/app/build.gradle',
    });
    expect((result.modResults as { contents: string }).contents).toContain(MLKIT_FACE_DEPENDENCY);
  });
});
