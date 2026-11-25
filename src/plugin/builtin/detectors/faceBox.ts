import { Platform } from 'react-native';
import type { DetectorPlugin, FrameData, VisionEvent } from '../../types';

// MLKit face detection is Android-only in this project (the Expo local
// module ships an Android implementation). The detector degrades to a
// no-op on iOS and Web so the guidance loop can keep calling it
// unconditionally.
//
// The face box is returned in normalized viewfinder coordinates so the
// host can feed it to GuidanceExecution as a vision-based alignment aid:
// a face that drifts out of the target circle revokes 'ready' the same
// way a sensor tick does.

type FaceBox = { x: number; y: number; w: number; h: number };

type MlkitModule = {
  detectFaces: (uri: string) => Promise<{
    faces: { frame: { x: number; y: number; width: number; height: number } }[];
    success: boolean;
    error: string | null;
  } | undefined>;
};

let mlkit: MlkitModule | null | undefined;

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

export function isFaceBoxSupported(): boolean {
  return Platform.OS === 'android' && loadMlkit() !== null;
}

export function faceBoxDetector(): DetectorPlugin {
  return {
    id: 'face-box',
    detect: async (frame: FrameData): Promise<VisionEvent | null> => {
      if (!isFaceBoxSupported()) return null;
      const module = loadMlkit();
      if (!module) return null;
      try {
        const result = await module.detectFaces(frame.dataUrl);
        if (!result?.success || result.faces.length === 0) return null;
        // Pick the largest face and normalize its box to 0-1 image space.
        const biggest = result.faces.reduce((a, b) =>
          a.frame.width * a.frame.height >= b.frame.width * b.frame.height ? a : b,
        );
        const box: FaceBox = {
          x: biggest.frame.x / frame.width,
          y: biggest.frame.y / frame.height,
          w: biggest.frame.width / frame.width,
          h: biggest.frame.height / frame.height,
        };
        return { type: 'face', data: box };
      } catch {
        return null;
      }
    },
  };
}
