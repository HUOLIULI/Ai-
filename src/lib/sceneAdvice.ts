import type { GuidanceConfig } from '../types/guidance';
import { recognizeScene } from './sceneAi';
import { sceneToRecommendation, type SceneRecommendation } from './sceneRecognition';
import { applyStyleFilterToPhoto } from '../plugin/builtin';

// Scene-aware one-tap advice for the review screen. The capture flow already
// auto-applies a style from scene recognition; this surfaces the same scene
// reading as an explicit suggestion the user can accept on an already-taken
// photo. It composes existing pieces (classify -> scene table -> style LUT)
// rather than introducing a new model output, and fails open like the others.

export type SceneAdvice = SceneRecommendation & { confidence: number };

// Classifies the photo and returns the matching style recommendation plus the
// rationale/exposure hint to show the user. Confidence comes straight from the
// classifier so the UI can decide how strongly to surface the suggestion.
export async function getSceneAdvice(config: GuidanceConfig, dataUrl: string, signal: AbortSignal, timeoutMs = 15000): Promise<SceneAdvice> {
  const reading = await recognizeScene(config, dataUrl, signal, timeoutMs);
  return { ...sceneToRecommendation(reading.scene), confidence: reading.confidence };
}

// Applies the recommended style's LUT to the photo. Delegates to the shared
// style-filter path so a third-party override of that style wins and the
// platform-adaptive backend renders it; fails open to the original uri.
export async function applySceneAdviceToPhoto(uri: string, advice: SceneAdvice): Promise<string> {
  return applyStyleFilterToPhoto(uri, advice.style);
}
