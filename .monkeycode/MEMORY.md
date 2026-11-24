# Project Memory — Drama (warm-lens)

## Testing & Build

[Testing setup constraints]
- Date: 2026-11-23
- Context: Discovered while adding a render smoke test for CameraCapture
- Category: Build Methods | Testing Methods
- Instructions:
  - jest.config.js `testMatch` must list BOTH `**/*.test.ts` and `**/*.test.tsx` — tsx component tests are silently skipped if only `.ts` is listed.
  - `@testing-library/react-native` v14 requires React 19; this project is on React 18.3.1. Pin `@testing-library/react-native@12.9.0` + `react-test-renderer@18.3.1`, installed with `--legacy-peer-deps`.
  - Component smoke tests must mock native-backed deps at the module boundary: `expo-camera`, `expo-linear-gradient`, `expo-status-bar`, `react-native-safe-area-context`, `@expo/vector-icons`, and the sibling child components. `@react-native-async-storage/async-storage` and `expo-secure-store` throw on require in jsdom — mock `src/store/captureStore` to avoid loading AsyncStorage.
  - `jest.mock` paths are relative to the TEST file, not the component. Tests live in `__tests__/`, so sibling components use `../X.tsx` and `src/hooks` is `../../../hooks/`.

## Component Architecture

[CameraCapture composition]
- Date: 2026-11-23
- Context: Task 6 refactor of the plugin-architecture plan
- Category: Environment Configuration
- Instructions:
  - `CameraCapture.tsx` is an orchestration layer (~263 lines). Presentational seams live in sibling files: `CameraHeader`, `SceneModeRow`, `CameraViewfinder` (owns focal pill), `CameraParameterCard`, `CameraStyleStrip`, `CaptureDeck`. Each carries its own StyleSheet.
  - The `Parameter` type is canonically exported from `CameraParameterPanel.tsx` and re-used by `CameraParameterCard.tsx`.

## Plugin / Filter Architecture

[Filter backend layering]
- Date: 2026-11-23
- Context: Wired the LUT pixel backend into the capture pipeline
- Category: Build Methods
- Instructions:
  - Pure LUT pixel math lives in `src/plugin/builtin/lutMath.ts` and is shared by the Web canvas backend and any future native base64 reader. This split exists to break a filters<->canvasBackend circular import.
  - `canvasBackend.ts` is Web-only (`Platform.OS === 'web' && typeof document !== 'undefined'`). Native passes the uri through unchanged until the `modules/image-filter` GPU backend lands.
  - Filter application is fail-open end to end: `applyLutToImageUri` and `applyStyleFilterToPhoto` both return the original uri on any error, so a filter failure never blocks a capture.
  - `applyStyleFilterToPhoto` looks the filter up from `pluginRegistry` by id `filter-${style}`, so a third-party same-id registration overrides the built-in.

[Guidance schema dual-source]
- Date: 2026-11-23
- Context: Added a schema consistency guard
- Category: Build Methods
- Instructions:
  - The v3 guidance JSON Schema is hand-maintained in two copies: runtime `GUIDANCE_SCHEMA` (`src/constants/guidanceProtocol.ts`, also sent as the model's `outputSchema`) and `docs/camera-guidance-v3.schema.json`. `src/lib/__tests__/schemaConsistency.test.ts` deep-compares them; edit both together or the build fails.
  - The prompt in `aiGuidance.ts` does NOT re-enumerate fields — it reuses `GUIDANCE_SCHEMA` via `outputSchema`, so there are only two schema copies to keep in sync, not three.

[APK release integrity]
- Date: 2026-11-23
- Context: Closed the sha256 verification gap
- Category: Operations & Deployment
- Instructions:
  - `parseRelease` (`src/lib/appRelease.ts`) extracts the APK sha256 from the GitHub Release asset `digest` field (format `sha256:<64 hex>`) into `asset.sha256`.
  - APKs must be uploaded as real GitHub Release assets (not just external links) for GitHub to populate `digest`; otherwise `sha256` stays null and native `verifyPackage` skips hash validation.
  - Non-APK assets and malformed digests keep `sha256` null, degrading gracefully to package-name + versionCode checks.

[Expo config plugin distribution]
- Date: 2026-11-23
- Context: Built the plugins/expo-drama distribution plugin
- Category: Build Methods
- Instructions:
  - `plugins/expo-drama` is a publishable Expo config plugin handling the two native configs autolinking misses: merging `REQUEST_INSTALL_PACKAGES` (app-installer) and injecting the MLKit face-detection dependency (faceBox).
  - Structure: pure functions (`permissions.ts`, `gradle.ts`) + thin mod wiring (`withDramaNative.ts`), wrapped in `createRunOncePlugin` for idempotency (repeated prebuild does not double-inject).
  - The two local native modules link themselves via `expo-module.config.json`; the plugin only fills permissions and dependencies.
  - `@expo/config-plugins` is a transitive dep (SDK 52, not in package.json). Plugin unit tests run the mod with an identity `nextMod` and assert on the returned `modResults`, reading `result.modResults.*` (nested, not `result.*`).

[On-device auto enhancement]
- Date: 2026-11-23
- Context: Built offline shutter decision + photo quality guard for "point-and-shoot to great photo"
- Category: Operations & Deployment
- Instructions:
  - Both features run fully offline (no model key) and follow the same pattern: pure decision function + separate collection side that feeds it signals.
  - `decideShutter` (`src/lib/shutterDecision.ts`): maps `ShutterSignals` (gyro shake, lighting stats, faces) to a `ShutterDecision` (whiteBalance/style/exposure/stability + reasons). WhiteBalance always derives from `CAMERA_STYLE_PRESETS[style].whiteBalance`. Wired into `useCameraGuidance`: gyro listener updates `shakeRef`, the guidance sample runs the lighting detector via `updateSignalRefs`, and `capture()` freezes the decision. Exposed as `shutterDecision` + shown in `ShutterDecisionCard`.
  - `assessQuality`/`computeQualityStats` (`src/lib/photoQuality.ts`): blur via adjacent-pixel gradient, exposure via mean + highlight ratio, closed eyes via `eyesOpen`. `analyzePhotoQuality` (`photoQualityGuard.ts`) decodes on Web canvas; native/canvas-less degrade to `assessQuality(null, null)` — never blocks saving. `PhotoReview` runs it on mount and shows a retake banner.
  - All thresholds (`DARK_MEAN`, `BRIGHT_HIGHLIGHTS`, `BLUR_SHARPNESS`, `SHAKY_SHAKE`) are centralised constants awaiting on-device calibration.
  - Closed-eye collection (Android MLKit landmarks) is a future hook; `assessQuality` already accepts the `eyesOpen` input.
  - Auto-apply closes the loop: with `autoStyle` on, the decision's recommended style is applied via `changeStyle(style, true)` (which lands whiteBalance/contrast through `styleTuning`). A manual style pick passes `fromAuto=false` and clears `autoStyle`. `refreshShutterDecision` is held in `refreshRef` for a stable identity so the auto-apply `useEffect` (deps `[shutterDecision, autoStyle]`) doesn't re-run every render; `changeStyle` is omitted from deps via eslint-disable (hoisted, reads refs).
