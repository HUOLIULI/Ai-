import type { AndroidManifest, ManifestUsesPermission } from '@expo/config-plugins/build/android/Manifest';

// The app-installer module installs update APKs, which requires this
// permission. Merging it here keeps the plugin self-contained: a consumer
// does not need to remember to add it to app.json.
export const REQUEST_INSTALL_PACKAGES = 'android.permission.REQUEST_INSTALL_PACKAGES';

function permissionName(entry: ManifestUsesPermission): string {
  return entry.$['android:name'];
}

// Idempotently add REQUEST_INSTALL_PACKAGES to the manifest's uses-permission
// list. Pure: returns a new manifest, never mutates the input.
export function ensureInstallPackagesPermission(manifest: AndroidManifest): AndroidManifest {
  const existing = manifest.manifest['uses-permission'] ?? [];
  if (existing.some(entry => permissionName(entry) === REQUEST_INSTALL_PACKAGES)) {
    return manifest;
  }
  return {
    ...manifest,
    manifest: {
      ...manifest.manifest,
      'uses-permission': [...existing, { $: { 'android:name': REQUEST_INSTALL_PACKAGES } }],
    },
  };
}
