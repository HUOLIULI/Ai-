import { requestAICompletion, type AIMessage } from './aiClient';
import type { GuidanceConfig } from '../types/guidance';
import { MIN_CROP, type CropBox } from './photoCrop';

// AI multi-composition. Where smart crop proposes a single reframed box, this
// pass returns several distinct composition variants (tight subject, rule of
// thirds, negative space, ...) so the user can preview and pick the framing
// that reads best. The model returns normalized crop boxes exactly like the
// crop pass; we just take an array of them, each with a short label. Pure
// normalization here; a failed call fails open at the caller.

export const MAX_VARIANTS = 3;

export type CompositionVariant = { label: string; box: CropBox; rationale: string };

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

const DEFAULT_LABEL = '构图方案';
const DEFAULT_RATIONALE = '已按构图优化裁剪。';
const DEFAULT_BOX: CropBox = { centerX: 0.5, centerY: 0.5, width: 1, height: 1 };

function normalizeBox(raw: Record<string, unknown>): CropBox {
  const num = (key: string): number => {
    const v = raw[key];
    return typeof v === 'number' && Number.isFinite(v) ? clamp01(v) : 0;
  };
  return {
    centerX: num('centerX'),
    centerY: num('centerY'),
    width: Math.max(MIN_CROP, num('width')),
    height: Math.max(MIN_CROP, num('height')),
  };
}

// Normalizes one model variant object. Malformed entries are dropped by the
// caller; a usable-but-partial entry degrades its label/rationale to defaults.
function normalizeVariant(raw: unknown): CompositionVariant | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const reading = raw as Record<string, unknown>;
  const label = typeof reading.label === 'string' && reading.label.trim().length > 0
    ? reading.label.trim()
    : DEFAULT_LABEL;
  const rationale = typeof reading.rationale === 'string' && reading.rationale.trim().length > 0
    ? reading.rationale.trim()
    : DEFAULT_RATIONALE;
  return { label, box: normalizeBox(reading), rationale };
}

// Normalizes the model's variants array into 1..MAX_VARIANTS clean options.
// Non-object entries are dropped; if nothing usable remains (or the field isn't
// an array) we fall back to a single default full-frame variant so the caller
// always has something to show.
export function normalizeCompositions(reading: Record<string, unknown>): CompositionVariant[] {
  const raw = reading.variants;
  if (!Array.isArray(raw)) return [{ label: DEFAULT_LABEL, box: { ...DEFAULT_BOX }, rationale: DEFAULT_RATIONALE }];
  const out: CompositionVariant[] = [];
  for (const entry of raw) {
    const variant = normalizeVariant(entry);
    if (variant) out.push(variant);
    if (out.length >= MAX_VARIANTS) break;
  }
  if (out.length === 0) return [{ label: DEFAULT_LABEL, box: { ...DEFAULT_BOX }, rationale: DEFAULT_RATIONALE }];
  return out;
}

// System prompt: the model acts as a composition director, returning up to three
// distinct framings with a short label for each. It must not describe the photo
// in prose beyond the required fields.
export const COMPOSITION_SYSTEM_PROMPT = [
  '你是一位摄影构图导演。分析这张照片，给出最多三个不同的构图方案，每个方案以画面主体为中心给出一个裁剪框。',
  '只返回 JSON，字段 variants 是一个数组，每个元素包含：',
  'label：方案名（中文，如「紧凑主体」「三分法」「留白」，不超过 6 字）；',
  'centerX、centerY：裁剪框中心在原图中的归一化位置（左上为 0,0，右下为 1,1）；',
  'width、height：裁剪框占原图宽高的比例（建议不小于 0.3，保留足够画面）；',
  'rationale：一句中文说明这个构图为什么出片。',
  '给出 1 到 3 个明显不同的方案，不要重复。不要解释字段之外的内容，不要返回像素坐标或相机参数。',
].join('\n');

export function buildCompositionMessages(dataUrl: string): AIMessage[] {
  return [
    { role: 'system', content: COMPOSITION_SYSTEM_PROMPT },
    { role: 'user', content: [
      { type: 'text', text: '给这张照片几个更好的构图方案。' },
      { type: 'image_url', image_url: { url: dataUrl } },
    ] },
  ];
}

export const COMPOSITION_SCHEMA = {
  type: 'object',
  properties: {
    variants: {
      type: 'array',
      description: 'Up to three distinct composition options.',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string', description: 'Short Chinese name for this framing.' },
          centerX: { type: 'number', description: 'Normalized crop center X, 0-1.' },
          centerY: { type: 'number', description: 'Normalized crop center Y, 0-1.' },
          width: { type: 'number', description: 'Crop width as a fraction of the source width, 0-1.' },
          height: { type: 'number', description: 'Crop height as a fraction of the source height, 0-1.' },
          rationale: { type: 'string', description: 'One-line reason this framing works.' },
        },
        required: ['label', 'centerX', 'centerY', 'width', 'height', 'rationale'],
      },
    },
  },
  required: ['variants'],
} as const;

// Asks the model for several composition options. Uses the same provider/config
// the guidance path already uses, with a JSON schema constraining the set. The
// caller is responsible for failing open on rejection.
export async function suggestCompositions(config: GuidanceConfig, dataUrl: string, signal: AbortSignal, timeoutMs = 15000): Promise<CompositionVariant[]> {
  const result = await requestAICompletion(config.provider, config, buildCompositionMessages(dataUrl), {
    signal, timeoutMs, json: true,
    outputSchema: { name: 'photo_compositions_v1', schema: COMPOSITION_SCHEMA as unknown as object },
  });
  return normalizeCompositions(JSON.parse(result.content) as Record<string, unknown>);
}
