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
  - Closed-eye detection is wired: `eyeStateFromProbabilities` (`src/lib/photoQuality.ts`) derives eyesOpen from MLKit's `leftEyeOpenProbability`/`rightEyeOpenProbability` (any open eye counts as open; missing probabilities -> null so the dimension is skipped). Android `analyzePhotoQuality` runs MLKit on the captured photo for the eye dimension; Web canvas provides blur/exposure. The two platforms are complementary and each fails open, so saving is never blocked. MLKit eye probabilities require `classificationMode`; `photoQualityGuard` lazily re-initializes the shared detector with it once (`ensureClassification`, idempotent, harmless to faceBox which reads only the frame box).
  - Auto-apply closes the loop: with `autoStyle` on, the decision's recommended style is applied via `changeStyle(style, true)` (which lands whiteBalance/contrast through `styleTuning`). A manual style pick passes `fromAuto=false` and clears `autoStyle`. `refreshShutterDecision` is held in `refreshRef` for a stable identity so the auto-apply `useEffect` (deps `[shutterDecision, autoStyle]`) doesn't re-run every render; `changeStyle` is omitted from deps via eslint-disable (hoisted, reads refs).
  - Auto-fill (dark-scene flash) follows the same pattern: `autoFlash` + the decision's `exposure.level === 'dark'` auto-enables flash on the back camera only (front has no flash). A manual flash change in `adjustParameters` clears `autoFlash`. Toggle via `toggleAutoFlash`, surfaced as a chip above the shutter decision card. `appliedAutoFlashRef` prevents re-apply until the scene lightens again.
  - Stability-gated shutter: blur is the top point-and-shoot failure. In `capture()`, read the LIVE `shakeRef` (`!isShakeStable(shakeRef.current)`, threshold `STABLE_SHAKE=0.4`) to decide whether to engage the gate — do NOT read the frozen decision, whose recomputed state only reaches `shutterDecision` on the next render (stale within the same call). If engaged, wait via `waitForStability` (`src/lib/captureStability.ts`) — poll until the hand settles, the `STABILITY_WAIT_MS=1200` deadline passes, or capture is cancelled, then fire. Unknown/invalid readings count as stable (never block); a restless hand captures after the deadline. `waitForStability` is injected with the shake source / deadline check / cancel check so the loop is unit-testable. `shakeRef` updates unconditionally in the gyro listener (before the guidance guard), so the gate works without AI guidance.
  - The gyro listener tracks the raw shake magnitude (`shakeRef.current = speed`) BEFORE the `enabledRef/activeRef/readyRef` guard, so the stability gate works whether or not AI guidance is on. The rest of the gyro logic (travel/moved/stableAfter/executor rotate) still runs only under guidance. `lastLightingRef` (feeding exposure/style/white-balance advice) still only updates in the guidance sampling loop — that's by design, since exposure/style advice is guidance-scoped, while anti-blur is a pure sensor capability.

[Album loads the device's real photo library]
- Date: 2026-11-23
- Context: Fixed the gap where the album tab was titled "all photos" but only listed photos this app itself captured/saved, never the device's broader existing library. (Note: savedUris/favoriteUris ARE persisted via captureStore partialize, so they survive restart; only the in-progress capturedUri is session-only. The real gap was the missing device library, not restart loss.)
- Category: Operations & Deployment
- Instructions:
  - `loadDevicePhotos` (`src/lib/media.ts`) reads the 60 newest device photos via `expo-media-library` `getAssetsAsync` (`SortBy.creationTime`, `MediaType.photo`). `expo-media-library` was already a dependency + registered in `app.json`. Requests read permission on first use; fails open to `[]` on denial/error/web (web has no device library), so session captures always render.
  - `getAlbumImages(capturedUri, savedUris, devicePhotos)` (`src/lib/album.ts`) merges: unsaved session capture leads (tag 本次拍摄 · 尚未保存), then saved session shots (已保存), then device photos newest-first (设备相册), deduped by uri so a shot saved this session isn't shown twice.
  - `AlbumPage` loads device photos once on mount via a cancelled-safe effect. This keeps the album useful across restarts instead of only reflecting the current session.

[AI enhancement features reuse the LUT engine + aiClient path]
- Date: 2026-11-23
- Context: Added three online AI enhancements (rule-of-thirds composition, AI color grade, AI beauty) that run through the existing LUT engine and qwen-vl aiClient path rather than adding new rendering backends.
- Category: Operations & Deployment
- Instructions:
  - The reusable pattern for any AI photo enhancement: vision model returns a handful of BOUNDED numeric params via `requestAICompletion` + a JSON `outputSchema`; a pure compiler maps those params onto a `LutSpec` (matrix/curve/temperature) that the existing LUT engine (`applyLutSpecToPhoto`) already applies. This keeps every enhancement pure/testable, offline-compilable, and consistent with the style filters.
  - Color grade (`src/lib/colorGrade.ts` + `colorGradeAi.ts`): five params (temperature/exposure/contrast/saturation/tint). Temperature -> `lut.temperature`; exposure/contrast -> tone `curve`; saturation/tint -> 3x3 `matrix` (saturation mixes channels toward luma with factor `1+p`). Compile in `colorGradeParamsToLut`.
  - Beauty (`src/lib/beauty.ts` + `beautyAi.ts`): three params (smoothing/brightening/warmth) mapped onto the color-grade space — smoothing -> NEGATIVE (flattening) contrast, brightening -> exposure, warmth -> temperature — then reused via `colorGradeParamsToLut`. Spatial effects (real skin blur, eye brightening) are OUT of scope for a per-pixel LUT; left for a future GPU backend.
  - Capture wiring (`useCameraGuidance.capture()`): after the style LUT, if `autoColorGradeRef`/`autoBeautyRef` is on and a model config exists, send the shutter photo's base64 (`takePictureAsync({ base64: true })`, NO second capture) through `analyzeColorGrade`/`analyzeBeauty`, compile to a LutSpec, and `applyLutSpecToPhoto` on top. Every step fails open (catch -> keep un-enhanced photo); never blocks saving.
  - UI toggles: `autoColorGrade`/`autoBeauty` state + `toggleAutoColorGrade`/`toggleAutoBeauty` on the guidance hook, surfaced as "AI 调色"/"AI 美颜" switches in `CameraGuidanceControls` (shown only when the handler prop is set), passed through `CameraCapture`. Toggle tests assert render/state/press/hidden-when-no-handler.
  - Normalizers clamp out-of-range and treat non-finite as neutral; parsers `JSON.parse` + clamp + default missing fields to neutral and throw on malformed JSON. Beware `-0` from negation (`-0 * k`) breaking `toEqual` deep-equality — normalize negative zero to `0`.
