import type { CameraMode, CameraStyle } from '../types/guidance';

// AI scene recognition. The vision model classifies a frame into one of a fixed
// set of scene labels; we map each label onto the mode, style, and a short
// exposure/flash hint so the camera can pre-configure itself for the detected
// scene. Pure mapping here so the scene->settings table stays testable and the
// model never has to emit camera parameters directly.

export const SCENE_LABELS = ['人像', '风景', '夜景', '美食', '逆光', '微距'] as const;
export type SceneLabel = typeof SCENE_LABELS[number];

export type SceneReading = { scene: SceneLabel; confidence: number };

export type SceneRecommendation = {
  scene: SceneLabel;
  mode: CameraMode;
  style: CameraStyle;
  exposureHint: string;
  rationale: string;
};

const DEFAULT_SCENE: SceneLabel = '风景';

// Scene -> settings table. Styles come from the existing four-style LUT set
// (清透/奶杏/薄荷/胶片); modes map onto the three guidance modes.
const SCENE_TABLE: Record<SceneLabel, Omit<SceneRecommendation, 'scene'>> = {
  人像: {
    mode: '人像', style: '奶杏',
    exposureHint: '利用现有柔光，避免直射闪光。',
    rationale: '检测到人像，切换人像模式与自然肤色风格。',
  },
  风景: {
    mode: '风景', style: '清透',
    exposureHint: '按现场光线曝光，远景不用闪光。',
    rationale: '检测到风景，切换风景模式与清透风格。',
  },
  夜景: {
    mode: '夜景', style: '奶杏',
    exposureHint: '保持稳定、避免强光过曝，远景不用闪光。',
    rationale: '检测到夜景，切换夜景模式与偏暖提亮风格。',
  },
  美食: {
    mode: '风景', style: '薄荷',
    exposureHint: '近距离柔和补光，避免顶光过暗。',
    rationale: '检测到美食，用清新鲜明风格突出食物质感。',
  },
  逆光: {
    mode: '风景', style: '清透',
    exposureHint: '偏重暗部曝光，避免天空过曝。',
    rationale: '检测到逆光，建议压低曝光保住高光层次。',
  },
  微距: {
    mode: '风景', style: '清透',
    exposureHint: '靠近主体，注意对焦与轻微补光。',
    rationale: '检测到微距，建议靠近并稳定持机。',
  },
};

function isFiniteNumber(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function normalizeScene(label: string, confidence?: number): SceneReading {
  const known = (SCENE_LABELS as readonly string[]).includes(label) ? label as SceneLabel : DEFAULT_SCENE;
  // An absent confidence means a deterministic label lookup (fully confident);
  // a provided-but-invalid value is untrusted data and reads as no confidence.
  const conf = confidence === undefined ? 1
    : isFiniteNumber(confidence) ? Math.max(0, Math.min(1, confidence))
      : 0;
  return { scene: known, confidence: conf };
}

export function sceneToRecommendation(label: SceneLabel | string): SceneRecommendation {
  const { scene } = normalizeScene(label);
  return { scene, ...SCENE_TABLE[scene] };
}

// JSON schema handed to requestAICompletion so the model returns a scene label
// plus a confidence.
export const SCENE_SCHEMA = {
  type: 'object',
  properties: {
    scene: { type: 'string', enum: [...SCENE_LABELS], description: 'The detected scene category.' },
    confidence: { type: 'number', description: 'Detection confidence from 0 to 1.' },
  },
  required: ['scene', 'confidence'],
} as const;
