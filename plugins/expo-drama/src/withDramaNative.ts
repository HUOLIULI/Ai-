import { createRunOncePlugin, withAndroidManifest, withAppBuildGradle } from '@expo/config-plugins';
import type { ExpoConfig } from '@expo/config-types';
import { ensureInstallPackagesPermission } from './permissions';
import { ensureMlkitFaceDependency } from './gradle';

// Expo config plugin that distributes Drama's native camera capabilities:
// - merges the REQUEST_INSTALL_PACKAGES permission needed by app-installer
// - injects the MLKit face-detection dependency used by the faceBox detector
// The camera-tuning and app-installer modules themselves are auto-linked from
// their expo-module.config.json; this plugin only wires what autolinking does
// not cover (the install permission and the MLKit artifact).
const withDramaNative = (config: ExpoConfig): ExpoConfig =>
  withAppBuildGradle(withAndroidManifest(config, config => {
    config.modResults = ensureInstallPackagesPermission(config.modResults);
    return config;
  }), config => {
    config.modResults.contents = ensureMlkitFaceDependency(config.modResults.contents);
    return config;
  });

export default createRunOncePlugin(withDramaNative, 'expo-drama', '1.0.0');
