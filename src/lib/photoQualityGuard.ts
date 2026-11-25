import { Platform } from 'react-native';
import { assessQuality, computeQualityStats, eyeStateFromProbabilities, type QualityReport } from './photoQuality';

// Collection side of the photo quality guard. Blur/exposure need pixel access
// (Web canvas); closed-eye needs MLKit (Android). The two are complementary:
// whichever platform provides a dimension feeds it into assessQuality, and
// missing dimensions degrade to "not evaluated" so saving is never blocked.

type MlkitModule = {
  detectFaces: (uri: string) => Promise<{
    faces: { leftEyeOpenProbability?: number | null; rightEyeOpenProbability?: number | null }[];
    success: boolean;
    error: string | null;
  } | undefined>;
  initialize: (options?: { classificationMode?: boolean; performanceMode?: string }) => Promise<unknown>;
};

let mlkit: MlkitModule | null | undefined;
// MLKit's eye-open probabilities are only populated when the shared detector is
// initialized with classification mode on. We flip it on lazily, once; faceBox
// only reads the frame box, so the extra classifications are harmless there.
let classificationEnsured = false;

async function ensureClassification(module: MlkitModule): Promise<void> {
  if (classificationEnsured) return;
  try {
    await module.initialize({ classificationMode: true, performanceMode: 'fast' });
  } catch {
    // If re-initialization fails the detector keeps its prior config; eye
    // probabilities may stay null and the closed-eye dimension safely skips.
  }
  classificationEnsured = true;
}

function loadMlkit(): MlkitModule | null {
  if (mlkit !== undefined) return mlkit;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    mlkit = require('@infinitered/react-native-mlkit-face-detection') as MlkitModule;
  } catch {
    mlkit = null;
  }
  return mlkit;
}

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

// Android-only: run MLKit face detection on the captured photo and derive an
// eyes-open state. Returns null when unsupported or no face, so the closed-eye
// dimension is skipped rather than guessed.
async function detectEyesOpen(uri: string): Promise<boolean | null> {
  if (Platform.OS !== 'android') return null;
  const module = loadMlkit();
  if (!module) return null;
  try {
    await ensureClassification(module);
    const result = await module.detectFaces(uri);
    if (!result?.success || result.faces.length === 0) return null;
    const face = result.faces.reduce((a, b) => a, result.faces[0]);
    return eyeStateFromProbabilities(face.leftEyeOpenProbability, face.rightEyeOpenProbability);
  } catch {
    return null;
  }
}

export async function analyzePhotoQuality(uri: string): Promise<QualityReport> {
  // Web: decode pixels on a canvas for blur/exposure; eyes need MLKit (Android).
  if (canvasAvailable()) {
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
  // Android (and other natives): no JS pixel decode, so blur/exposure are skipped
  // and only the MLKit closed-eye dimension runs. Fails open to "not evaluated".
  const eyesOpen = await detectEyesOpen(uri);
  return assessQuality(null, eyesOpen);
}
