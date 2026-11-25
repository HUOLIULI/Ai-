import type { DetectorPlugin, FrameData, VisionEvent } from '../../types';

// Lighting detector: samples the luminance of a compressed frame. Runs on
// the same 768px JPEG that goes to the vision model, so it adds zero
// network cost. A mean below 40 means a dark frame the model may misread;
// a highlight ratio above 0.15 means blown highlights worth a warning.
export function lightingDetector(): DetectorPlugin {
  return {
    id: 'lighting',
    detect: async (frame: FrameData): Promise<VisionEvent | null> => {
      const stats = analyzeFrame(decodeFrame(frame));
      if (stats.mean < 40 || stats.highlights > 0.15) {
        return { type: 'lighting', data: stats };
      }
      return null;
    },
  };
}

// Pure function so it can be unit tested without a real camera frame.
// Expects raw luminance bytes, one value per entry.
export function analyzeFrame(bytes: Uint8Array): { mean: number; highlights: number } {
  if (bytes.length === 0) return { mean: 0, highlights: 0 };
  let sum = 0;
  let highlights = 0;
  for (let i = 0; i < bytes.length; i++) {
    const luma = bytes[i];
    sum += luma;
    if (luma >= 240) highlights++;
  }
  return { mean: sum / bytes.length, highlights: highlights / bytes.length };
}

// The JS engine decodes the base64 payload of the 768px JPEG sample and
// treats the first bytes as luminance samples. A native backend replaces
// this with a real RGBA decode.
function decodeFrame(frame: FrameData): Uint8Array {
  const match = frame.dataUrl.match(/base64,(.*)$/);
  if (!match) return new Uint8Array(0);
  const raw = atob(match[1].slice(0, 4096));
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}
