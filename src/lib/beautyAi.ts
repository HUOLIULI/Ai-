import { requestAICompletion, type AIMessage } from './aiClient';
import type { GuidanceConfig } from '../types/guidance';
import { BEAUTY_PARAMS, BEAUTY_SCHEMA, normalizeBeauty, type BeautyParams } from './beauty';

// System prompt: the model acts as a beauty retoucher. It sees one portrait and
// returns three bounded parameters; the client compiles them into a LUT. It
// must not describe the face in prose or return pixel values.
export const BEAUTY_SYSTEM_PROMPT = [
  '你是一位专业人像修图师。分析这张人像，只返回一组美颜参数，让皮肤看起来更柔滑通透。',
  '每个参数是数字：',
  'smoothing：磨皮强度，0 到 1，越大越柔滑；',
  'brightening：提亮，0 到 1，越大越亮；',
  'warmth：肤色冷暖，-1 偏冷，+1 偏暖。',
  '只返回这三个数字的 JSON，不要解释，不要返回文字或像素值。',
].join('\n');

export function buildBeautyMessages(dataUrl: string): AIMessage[] {
  return [
    { role: 'system', content: BEAUTY_SYSTEM_PROMPT },
    { role: 'user', content: [
      { type: 'text', text: '分析这张人像，返回美颜参数。' },
      { type: 'image_url', image_url: { url: dataUrl } },
    ] },
  ];
}

export function parseBeauty(content: string): BeautyParams {
  const raw = JSON.parse(content) as Record<string, unknown>;
  const out: Partial<Record<keyof BeautyParams, number>> = {};
  for (const key of BEAUTY_PARAMS) {
    const v = raw[key];
    if (typeof v === 'number') out[key] = v;
  }
  return normalizeBeauty(out);
}

// Requests a beauty pass for one portrait. Uses the same provider/config the
// guidance path already uses, with a JSON schema so the model returns exactly
// the three bounded numbers.
export async function analyzeBeauty(config: GuidanceConfig, dataUrl: string, signal: AbortSignal, timeoutMs = 20000): Promise<BeautyParams> {
  const result = await requestAICompletion(config.provider, config, buildBeautyMessages(dataUrl), {
    signal, timeoutMs, json: true,
    outputSchema: { name: 'camera_beauty_v1', schema: BEAUTY_SCHEMA as unknown as object },
  });
  return parseBeauty(result.content);
}
