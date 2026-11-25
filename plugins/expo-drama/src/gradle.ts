// The on-device face-box detector uses MLKit face detection on Android. The
// app-installer/camera-tuning modules are auto-linked from their
// expo-module.config.json, but the MLKit artifact is not bundled by any
// Expo package, so the config plugin injects it into app/build.gradle.
export const MLKIT_FACE_DEPENDENCY = 'com.google.mlkit:face-detection:16.1.0';

// Idempotently add the MLKit face-detection dependency to app/build.gradle.
// Pure: returns a new string, never mutates input. Injects inside an existing
// `dependencies { ... }` block, or appends a new block when none exists.
export function ensureMlkitFaceDependency(buildGradle: string): string {
  if (buildGradle.includes(MLKIT_FACE_DEPENDENCY)) return buildGradle;
  const statement = `    implementation "${MLKIT_FACE_DEPENDENCY}"`;
  const blockPattern = /dependencies\s*\{/;
  const match = blockPattern.exec(buildGradle);
  if (!match) {
    const separator = buildGradle.endsWith('\n') ? '\n' : '\n\n';
    return `${buildGradle}${separator}dependencies {\n${statement}\n}\n`;
  }
  const insertAt = match.index + match[0].length;
  const before = buildGradle.slice(0, insertAt);
  const after = buildGradle.slice(insertAt);
  return `${before}\n${statement}${after}`;
}
