import { requestAICompletion, type AIMessage } from './aiClient';
import type { GuidanceConfig } from '../types/guidance';
import { COLOR_GRADE_PARAMS, COLOR_GRADE_SCHEMA, normalizeColorGrade, type ColorGradeParams } from './colorGrade';

// System prompt: the model acts as a colorist. It sees one frame and returns a
// small set of bounded grading parameters; the client compiles them into a LUT.
// It must not describe the scene in prose or return pixel values.
export const COLOR_GRADE_SYSTEM_PROMPT = [
  '你是一位专业调色师。分析这张照片的画面，只返回一组调色参数，让照片更好看。',
  '每个参数是 -1 到 1 之间的数字：',
  'temperature：色温，-1 偏冷，+1 偏暖；',
  'exposure：亮度，-1 更暗，+1 更亮；',
  'contrast：对比，-1 更平，+1 更通透；',
  'saturation：饱和，-1 更淡，+1 更鲜艳；',
  'tint：色调，-1 偏品红，+1 偏绿。',
  '只返回这五个数字的 JSON，不要解释，不要返回文字或像素值。',
].join('\n');

export function buildColorGradeMessages(dataUrl: string): AIMessage[] {
  return [
    { role: 'system', content: COLOR_GRADE_SYSTEM_PROMPT },
    { role: 'user', content: [
      { type: 'text', text: '分析这张照片，返回调色参数。' },
      { type: 'image_url', image_url: { url: dataUrl } },
    ] },
  ];
}

export function parseColorGrade(content: string): ColorGradeParams {
  const raw = JSON.parse(content) as Record<string, unknown>;
  const out: Partial<Record<keyof ColorGradeParams, number>> = {};
  for (const key of COLOR_GRADE_PARAMS) {
    const v = raw[key];
    if (typeof v === 'number') out[key] = v;
  }
  return normalizeColorGrade(out);
}

// Requests a color grade for one frame. Uses the same provider/config the
// guidance path already uses, with a JSON schema so the model returns exactly
// the five bounded numbers.
export async function analyzeColorGrade(config: GuidanceConfig, dataUrl: string, signal: AbortSignal, timeoutMs = 20000): Promise<ColorGradeParams> {
  const result = await requestAICompletion(config.provider, config, buildColorGradeMessages(dataUrl), {
    signal, timeoutMs, json: true,
    outputSchema: { name: 'camera_color_grade_v1', schema: COLOR_GRADE_SCHEMA as unknown as object },
  });
  return parseColorGrade(result.content);
}
