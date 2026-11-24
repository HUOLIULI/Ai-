import type { CameraStyle, Guidance, WhiteBalance } from '../types/guidance';

export type LutSpec = {
  name: string;
  // 3x3 color matrix, row-major: [r'r, r'g, r'b, g'r, g'g, g'b, b'r, b'g, b'b]
  matrix: number[];
  // Optional tone curve control points, ascending x.
  curve?: [number, number][];
  // Color temperature shift in Kelvin-ish units, negative = cooler.
  temperature?: number;
  // Film grain amount 0-1.
  grain?: number;
};

export type ModePlugin = {
  id: string;
  label: string;
  prompt: string;
  validate?: (g: Guidance) => string | null;
};

export type StylePlugin = {
  id: CameraStyle;
  label: string;
  description: string;
  preset: { whiteBalance: WhiteBalance; contrast: number | null };
  lut: LutSpec;
};

export type FrameData = { width: number; height: number; dataUrl: string; capturedAt: number };
export type VisionEvent = { type: 'face' | 'sceneChange' | 'lighting'; data: unknown };
export type DetectorPlugin = {
  id: string;
  detect: (frame: FrameData) => Promise<VisionEvent | null>;
};

export type FilterBackend = { kind: 'js' | 'gpu'; name: string; available(): boolean };
export type FilterPlugin = {
  id: string;
  apply: (backend: FilterBackend, uri: string) => Promise<string>;
};

export type DramaPlugin = {
  id: string;
  modes?: ModePlugin[];
  styles?: StylePlugin[];
  filters?: FilterPlugin[];
  detectors?: DetectorPlugin[];
};
