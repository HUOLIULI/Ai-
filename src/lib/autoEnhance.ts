import type { GuidanceConfig } from '../types/guidance';
import { getSceneAdvice, type SceneAdvice } from './sceneAdvice';
import { analyzeWhiteBalance, applyWbCorrectionToPhoto, type WbReading } from './wbCorrection';
import { applyStyleFilterToPhoto } from '../plugin/builtin';
import type { FilterBackend } from '../plugin/types';

// One-tap auto-enhance: the "just make it good" action. Composes two verified
// passes — scene-aware style and corrective white-balance/exposure — into a
// single deliberate step. The two model reads are independent (both only need
// the frame), so they run in parallel to keep the round trip fast; the results
// are then applied in sequence (style LUT first, corrective grade on top). No
// new model output is introduced — this only orchestrates existing pieces.

export type AutoEnhancePlan = { advice: SceneAdvice; wb: WbReading };

// Runs scene recognition and white-balance reading concurrently for one frame.
export async function planAutoEnhance(config: GuidanceConfig, dataUrl: string, signal: AbortSignal, timeoutMs = 20000): Promise<AutoEnhancePlan> {
  const [advice, wb] = await Promise.all([
    getSceneAdvice(config, dataUrl, signal, timeoutMs),
    analyzeWhiteBalance(config, dataUrl, signal, timeoutMs),
  ]);
  return { advice, wb };
}

// Applies an auto-enhance plan to the photo: the recommended style LUT first,
// then the corrective white-balance grade scaled by strength. Fails open — any
// backend error propagates to the caller and the source photo is kept.
export async function applyAutoEnhanceToPhoto(uri: string, plan: AutoEnhancePlan, backend: FilterBackend, strength = 1): Promise<string> {
  const styled = await applyStyleFilterToPhoto(uri, plan.advice.style);
  return applyWbCorrectionToPhoto(styled, plan.wb, backend, strength);
}
