import { Platform } from 'react-native';
import { assessQuality, computeQualityStats, type QualityReport } from './photoQuality';

// Collection side of the photo quality guard. Decodes the captured photo on a
// Web canvas, computes luminance stats, and feeds assessQuality. Native and
// canvas-less environments degrade to assessQuality(null, null): no retake hint,
// saving is never blocked. Closed-eye (MLKit landmarks) hooks in on Android later.

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('成片加载失败'));
    img.src = src;
  });
}

function canvasAvailable(): boolean {
  return Platform.OS === 'web' && typeof document !== 'undefined';
}

export async function analyzePhotoQuality(uri: string): Promise<QualityReport> {
  if (!canvasAvailable()) return assessQuality(null, null);
  try {
    const img = await loadImage(uri);
    const width = img.naturalWidth;
    const height = img.naturalHeight;
    if (!width || !height) return assessQuality(null, null);
    // Downscale to a fixed analysis width so the gradient metric is comparable
    // across capture resolutions.
    const analysisWidth = 256;
    const scale = Math.min(1, analysisWidth / width);
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return assessQuality(null, null);
    ctx.drawImage(img, 0, 0, w, h);
    const frame = ctx.getImageData(0, 0, w, h);
    const luma = new Uint8Array(w * h);
    for (let i = 0; i < luma.length; i++) {
      const r = frame.data[i * 4];
      const g = frame.data[i * 4 + 1];
      const b = frame.data[i * 4 + 2];
      luma[i] = (r * 299 + g * 587 + b * 114) / 1000;
    }
    return assessQuality(computeQualityStats(luma), null);
  } catch {
    return assessQuality(null, null);
  }
}
