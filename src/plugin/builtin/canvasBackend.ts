import { Platform } from 'react-native';
import type { LutSpec } from '../types';
import { applyLutToImageData } from './lutMath';

// Web canvas pixel backend. Loads an image into a canvas, runs the LUT over
// the RGBA pixels, and returns a new data URL. Only available on web where the
// DOM canvas exists; native falls back to the GPU backend later.
export const canvasFilterBackend = {
  kind: 'js' as const,
  name: 'web-canvas-lut',
  available: () => Platform.OS === 'web' && typeof document !== 'undefined',
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('滤镜加载图片失败'));
    img.src = src;
  });
}

export async function applyLutToImageUri(uri: string, lut: LutSpec): Promise<string> {
  // Fail open: a filter error must never block a capture, so any failure
  // returns the original uri unchanged.
  if (!canvasFilterBackend.available()) return uri;
  try {
    const img = await loadImage(uri);
    const width = img.naturalWidth;
    const height = img.naturalHeight;
    if (!width || !height) return uri;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return uri;
    ctx.drawImage(img, 0, 0);
    const frame = ctx.getImageData(0, 0, width, height);
    const filtered = applyLutToImageData(frame, lut);
    ctx.putImageData(filtered, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.95);
  } catch {
    return uri;
  }
}
