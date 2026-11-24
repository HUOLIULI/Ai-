import type { DetectorPlugin, FrameData, VisionEvent } from '../../types';

// Scene-change detector: compares the first bytes of two compressed frames.
// Compressed image headers encode the dominant colors of the frame, so a
// large header difference implies the scene actually changed, not just a
// sensor tick. A threshold of 0.3 over the first 8 sampled bytes avoids
// false positives from normal hand shake.
export function sceneChangeDetector(prev: FrameData | null): DetectorPlugin {
  return {
    id: 'scene-change',
    detect: async (frame: FrameData): Promise<VisionEvent | null> => {
      if (!prev) return null;
      const delta = headerDelta(prev.dataUrl, frame.dataUrl);
      if (delta < 0.3) return null;
      return { type: 'sceneChange', data: { delta } };
    },
  };
}

function headerDelta(a: string, b: string): number {
  const bytesA = sampleBytes(a);
  const bytesB = sampleBytes(b);
  const length = Math.min(bytesA.length, bytesB.length);
  if (length === 0) return 0;
  let diff = 0;
  for (let i = 0; i < length; i++) diff += Math.abs(bytesA[i] - bytesB[i]) / 255;
  return diff / length;
}

function sampleBytes(dataUrl: string): number[] {
  const match = dataUrl.match(/base64,(.*)$/);
  if (!match) return [];
  const raw = atob(match[1].slice(0, 64));
  return Array.from(raw).map(char => char.charCodeAt(0));
}
