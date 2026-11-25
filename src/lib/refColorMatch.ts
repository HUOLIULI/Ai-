import { requestAICompletion, type AIMessage } from './aiClient';
import type { GuidanceConfig } from '../types/guidance';
import { COLOR_GRADE_SCHEMA, colorGradeParamsToLut, type ColorGradeParams } from './colorGrade';
import { parseColorGrade } from './colorGradeAi';
import { applyLutSpecToPhoto } from '../plugin/builtin/filters';
import type { FilterBackend } from '../plugin/types';

// Reference color match: the vision model sees two frames — the source photo
// (index 0) and a reference photo whose look the user wants (index 1) — and
// returns a small set of bounded grading parameters that, compiled to a LUT and
// applied to the source, pull its color toward the reference. Pure math lives in
// colorGrade.ts; here we only drive the multi-image request and apply the result.

// Order matters and must match the user message below: source first, reference
// second, so the prompt and the image order never disagree.
export const REFERENCE_GRADE_SYSTEM_PROMPT = [
  '你是一位专业调色师。会看到两张照片：第一张是原图，第二张是参考图。',
  '把参考图的色调复刻到原图上，只返回一组调色参数，让原图的色彩风格贴近参考图。',
  '每个参数是 -1 到 1 之间的数字：',
  'temperature：色温，-1 偏冷，+1 偏暖；',
  'exposure：亮度，-1 更暗，+1 更亮；',
  'contrast：对比，-1 更平，+1 更通透；',
  'saturation：饱和，-1 更淡，+1 更鲜艳；',
  'tint：色调，-1 偏品红，+1 偏绿。',
  '只返回这五个数字的 JSON，不要解释，不要返回文字或像素值。',
].join('\n');

export function buildReferenceGradeMessages(sourceDataUrl: string, referenceDataUrl: string): AIMessage[] {
  return [
    { role: 'system', content: REFERENCE_GRADE_SYSTEM_PROMPT },
    { role: 'user', content: [
      { type: 'text', text: '第一张是原图，第二张是参考图。分析两者色彩差异，返回把参考图色调套到原图的调色参数。' },
      { type: 'image_url', image_url: { url: sourceDataUrl } },
      { type: 'image_url', image_url: { url: referenceDataUrl } },
    ] },
  ];
}

// Applies a reference-match grade to the source photo: compiles the returned
// parameters into the shared LUT engine and renders through the active backend.
// Fails open — any backend error surfaces to the caller and the source is kept.
export async function applyReferenceGradeToPhoto(sourceUri: string, params: Partial<Record<keyof ColorGradeParams, number>>, backend: FilterBackend): Promise<string> {
  const lut = colorGradeParamsToLut(params);
  return applyLutSpecToPhoto(sourceUri, lut, backend);
}

// Requests a reference color match. Sends source + reference as two images in
// one user message (the AIMessage content array carries both), constrained by
// the same bounded-parameter JSON schema the auto color grade uses.
export async function analyzeReferenceGrade(config: GuidanceConfig, sourceDataUrl: string, referenceDataUrl: string, signal: AbortSignal, timeoutMs = 20000): Promise<ColorGradeParams> {
  const result = await requestAICompletion(config.provider, config, buildReferenceGradeMessages(sourceDataUrl, referenceDataUrl), {
    signal, timeoutMs, json: true,
    outputSchema: { name: 'camera_reference_grade_v1', schema: COLOR_GRADE_SCHEMA as unknown as object },
  });
  return parseColorGrade(result.content);
}
