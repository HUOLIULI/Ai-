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
