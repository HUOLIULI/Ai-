import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import type { LutSpec } from '../types';

// Native bitmap LUT backend for Android. Bridges the shared LutSpec to the
// ImageFilter Expo module, which runs the same pixel math as the Web canvas
// backend over a decoded bitmap and writes a JPEG to the app cache. Optional:
// when the native module is missing (Expo Go, iOS) the backend reports
// unavailable and the caller keeps the un-enhanced photo. The module is
// resolved lazily on each call so a late-registered native module is picked
// up and tests can swap it.
type NativeFilterModule = {
  apply(uri: string, matrix: number[], curve: number[], temperature: number, grain: number, vignette: number): Promise<string>;
};

function resolveNative(): NativeFilterModule | null {
  if (Platform.OS === 'web') return null;
  try {
    return requireOptionalNativeModule<NativeFilterModule>('ImageFilter');
  } catch {
    return null;
  }
}

export const nativeFilterBackend = {
  kind: 'gpu' as const,
  name: 'native-bitmap-lut',
  available: () => resolveNative() != null,
};

// The native module takes the tone curve as a flat list [x0, y0, x1, y1, ...]
// to avoid nested-array marshalling; mirror the Web backend's control points.
function flattenCurve(curve?: [number, number][]): number[] {
  if (!curve || curve.length < 2) return [];
  return curve.flat();
}

export async function applyLutToImageUri(uri: string, lut: LutSpec): Promise<string> {
  const native = resolveNative();
  if (!native) return uri;
  try {
    return await native.apply(
      uri,
      lut.matrix,
      flattenCurve(lut.curve),
      lut.temperature ?? 0,
      lut.grain ?? 0,
      lut.vignette ?? 0
    );
  } catch {
    return uri;
  }
}
