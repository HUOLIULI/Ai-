import { ensureInstallPackagesPermission, REQUEST_INSTALL_PACKAGES } from '../permissions';
import type { AndroidManifest } from '@expo/config-plugins/build/android/Manifest';

function emptyManifest(): AndroidManifest {
  return { manifest: { $: { 'xmlns:android': 'http://schemas.android.com/apk/res/android' }, queries: [] } };
}

function permissionNames(manifest: AndroidManifest): string[] {
  return (manifest.manifest['uses-permission'] ?? []).map(entry => entry.$['android:name']);
}

describe('ensureInstallPackagesPermission', () => {
  it('exports the REQUEST_INSTALL_PACKAGES permission name', () => {
    expect(REQUEST_INSTALL_PACKAGES).toBe('android.permission.REQUEST_INSTALL_PACKAGES');
  });

  it('adds the permission when absent', () => {
    const out = ensureInstallPackagesPermission(emptyManifest());
    expect(permissionNames(out)).toContain(REQUEST_INSTALL_PACKAGES);
  });

  it('does not duplicate the permission when already present', () => {
    const withPerm = ensureInstallPackagesPermission(emptyManifest());
    const again = ensureInstallPackagesPermission(withPerm);
    const matches = permissionNames(again).filter(name => name === REQUEST_INSTALL_PACKAGES);
    expect(matches).toHaveLength(1);
  });

  it('preserves existing permissions when adding', () => {
    const manifest = emptyManifest();
    manifest.manifest['uses-permission'] = [{ $: { 'android:name': 'android.permission.CAMERA' } }];
    const out = ensureInstallPackagesPermission(manifest);
    const names = permissionNames(out);
    expect(names).toContain('android.permission.CAMERA');
    expect(names).toContain(REQUEST_INSTALL_PACKAGES);
  });

  it('does not mutate the input manifest', () => {
    const manifest = emptyManifest();
    const snapshot = JSON.stringify(manifest);
    ensureInstallPackagesPermission(manifest);
    expect(JSON.stringify(manifest)).toBe(snapshot);
  });
});
