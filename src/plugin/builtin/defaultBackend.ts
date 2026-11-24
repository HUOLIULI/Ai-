import { Platform } from 'react-native';
import type { FilterBackend } from '../types';
import { canvasFilterBackend } from './canvasBackend';
import { nativeFilterBackend } from './nativeBackend';

// Picks the LUT backend that actually renders pixels on the current platform:
// web -> the DOM canvas backend; Android -> the native bitmap module; iOS ->
// the canvas backend, which reports unavailable and fails open (no native iOS
// bitmap module yet). Callers use this instead of hardcoding a backend so an
// enhancement renders wherever a backend exists and keeps the original photo
// where none does.
export function defaultFilterBackend(): FilterBackend {
  if (Platform.OS === 'android') return nativeFilterBackend;
  return canvasFilterBackend;
}
