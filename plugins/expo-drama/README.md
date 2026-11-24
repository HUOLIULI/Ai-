# expo-drama

Expo config plugin distributing Drama's native camera capabilities.

Drama's two local native modules (`modules/camera-tuning`, `modules/app-installer`)
link themselves via `expo-module.config.json`. This plugin handles the two native
configs autolinking does not cover:

- Merges the `REQUEST_INSTALL_PACKAGES` permission (needed for app-installer).
- Injects the MLKit face-detection dependency (needed for the faceBox detector).

## Structure

- `src/permissions.ts` — pure function that merges the install-packages permission.
- `src/gradle.ts` — pure function that injects the MLKit dependency.
- `src/withDramaNative.ts` — thin mod wiring (`withAndroidManifest` + `withAppBuildGradle`),
  wrapped in `createRunOncePlugin` for idempotency.

Both pure functions are immutable and unit-tested (`src/__tests__/`).

## Usage

The plugin is already registered in `app.json`:

```json
"plugins": [
  "./plugins/expo-drama"
]
```

Rebuild the native project for it to take effect:

```bash
npx expo prebuild --platform android
```

Verify the generated `AndroidManifest.xml` contains `REQUEST_INSTALL_PACKAGES` and
`android/app/build.gradle` contains `com.google.mlkit:face-detection`.

## Testing

```bash
npx jest plugins/expo-drama
```
