import { requestAICompletion, type AIMessage } from './aiClient';
import type { GuidanceConfig } from '../types/guidance';
import type { FilterBackend } from '../plugin/types';
import { applyLutSpecToPhoto } from '../plugin/builtin/filters';
import { colorGradeParamsToLut, normalizeColorGrade, COLOR_GRADE_PARAMS, type ColorGradeParams } from './colorGrade';
import { beautyParamsToLut, normalizeBeauty, BEAUTY_PARAMS, type BeautyParams } from './beauty';

// Natural-language editing ("把天空调蓝一点"). The vision model reads the frame
// plus the user's instruction and returns a color-grade and a beauty parameter
// set that fulfil it. The client compiles both through the existing LUT engine,
// so an instruction never has to emit pixel values or image data.

export type NlEditParams = { grade: ColorGradeParams; look: BeautyParams };

export const NL_EDIT_SYSTEM_PROMPT = [
  '你是一位专业修图师。根据用户的自然语言指令，分析这张照片，返回一组能实现该指令的调色和美颜参数。',
  '返回 JSON，包含两个字段：',
  'grade：调色参数 { temperature, exposure, contrast, saturation, tint }，每个是 -1 到 1 的数字；',
  'look：美颜参数 { smoothing, brightening, warmth }，smoothing/brightening 是 0 到 1，warmth 是 -1 到 1。',
  '只返回这个 JSON，不要解释，不要返回文字或像素值。严格按用户指令调整，指令没提到的参数保持 0（中性）。',
].join('\n');

export function buildNlEditMessages(instruction: string, dataUrl: string): AIMessage[] {
  return [
    { role: 'system', content: NL_EDIT_SYSTEM_PROMPT },
    { role: 'user', content: [
      { type: 'text', text: `修图指令：${instruction}` },
      { type: 'image_url', image_url: { url: dataUrl } },
    ] },
  ];
}

function pickNumbered(raw: Record<string, unknown>, keys: readonly string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of keys) {
    const v = raw[key];
    if (typeof v === 'number') out[key] = v;
  }
  return out;
}

export function parseNlEdit(content: string): NlEditParams {
  const root = JSON.parse(content) as Record<string, unknown>;
  const gradeRaw = typeof root.grade === 'object' && root.grade !== null ? root.grade as Record<string, unknown> : {};
  const lookRaw = typeof root.look === 'object' && root.look !== null ? root.look as Record<string, unknown> : {};
  return {
    grade: normalizeColorGrade(pickNumbered(gradeRaw, COLOR_GRADE_PARAMS)),
    look: normalizeBeauty(pickNumbered(lookRaw, BEAUTY_PARAMS)),
  };
}

// Identity-ish passthrough that exists so callers have a single named step to
// validate/normalize an edit before compiling it to a LUT. Kept pure and total
// so a malformed edit degrades to neutral rather than throwing.
export function applyNlEditToParams(edit: NlEditParams): NlEditParams {
  return {
    grade: normalizeColorGrade(edit.grade),
    look: normalizeBeauty(edit.look),
  };
}

// Applies a natural-language edit to a photo by compiling the grade and look
// parameter sets into LUTs and running them over the image (grade first, then
// the beauty look on top). Fails open: any backend error returns the original
// uri so editing never destroys the captured photo.
export async function applyNlEditToPhoto(uri: string, edit: NlEditParams, backend: FilterBackend): Promise<string> {
  const { grade, look } = applyNlEditToParams(edit);
  try {
    let out = await applyLutSpecToPhoto(uri, colorGradeParamsToLut(grade), backend);
    out = await applyLutSpecToPhoto(out, beautyParamsToLut(look), backend);
    return out;
  } catch {
    return uri;
  }
}

// JSON schema constraining the model to the grade + look parameter sets.
export const NL_EDIT_SCHEMA = {
  type: 'object',
  properties: {
    grade: {
      type: 'object',
      properties: {
        temperature: { type: 'number' }, exposure: { type: 'number' }, contrast: { type: 'number' },
        saturation: { type: 'number' }, tint: { type: 'number' },
      },
      required: ['temperature', 'exposure', 'contrast', 'saturation', 'tint'],
    },
    look: {
      type: 'object',
      properties: {
        smoothing: { type: 'number' }, brightening: { type: 'number' }, warmth: { type: 'number' },
      },
      required: ['smoothing', 'brightening', 'warmth'],
    },
  },
  required: ['grade', 'look'],
} as const;

// Requests an edit for one frame under a natural-language instruction. Uses the
// same provider/config the guidance path already uses.
export async function editPhotoFromInstruction(config: GuidanceConfig, instruction: string, dataUrl: string, signal: AbortSignal, timeoutMs = 25000): Promise<NlEditParams> {
  const result = await requestAICompletion(config.provider, config, buildNlEditMessages(instruction, dataUrl), {
    signal, timeoutMs, json: true,
    outputSchema: { name: 'camera_nl_edit_v1', schema: NL_EDIT_SCHEMA as unknown as object },
  });
  return parseNlEdit(result.content);
}
