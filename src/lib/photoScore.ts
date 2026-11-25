import { requestAICompletion, type AIMessage } from './aiClient';
import type { GuidanceConfig } from '../types/guidance';

// AI photo scoring. The vision model grades a finished photo across five
// dimensions and returns a one-line summary plus a few actionable tips, so the
// user can quickly judge which shot to keep or retake. Pure normalization here;
// the model never has to emit pixels, and a failed call fails open at the caller.

export const SCORE_DIMENSIONS = ['composition', 'lighting', 'color', 'sharpness', 'aesthetics'] as const;
export type ScoreDimension = typeof SCORE_DIMENSIONS[number];

export type PhotoScore = {
  overall: number;
  dimensions: Record<ScoreDimension, number>;
  summary: string;
  tips: string[];
};

// English schema keys -> Chinese labels shown in the score card.
export const DIMENSION_LABELS: Record<ScoreDimension, string> = {
  composition: '构图',
  lighting: '光线',
  color: '色彩',
  sharpness: '锐度',
  aesthetics: '美学',
};

// Chinese descriptions used in the system prompt so the model understands each
// dimension's intent without the prompt embedding any score values.
export const DIMENSION_HINTS: Record<ScoreDimension, string> = {
  composition: '构图：主体位置、三分法、画面平衡与留白',
  lighting: '光线：曝光、光影层次与光的方向',
  color: '色彩：白平衡、色调与饱和度',
  sharpness: '锐度：对焦是否准确、画面是否清晰',
  aesthetics: '美学：整体观感与感染力',
};

const MAX_TIPS = 3;

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

// Normalizes one model reading into a PhotoScore. Untrusted numbers are clamped
// to 0..100; a missing or invalid dimension degrades to 0 rather than guessing.
// The overall score is the rounded mean of the five dimensions. Tips are
// filtered to non-empty strings and capped so the card stays readable.
export function normalizeScore(reading: Record<string, unknown>): PhotoScore {
  const dimensions = {} as Record<ScoreDimension, number>;
  for (const key of SCORE_DIMENSIONS) {
    const raw = reading[key];
    dimensions[key] = typeof raw === 'number' && Number.isFinite(raw) ? clampScore(raw) : 0;
  }
  const sum = SCORE_DIMENSIONS.reduce((acc, key) => acc + dimensions[key], 0);
  const overall = Math.round(sum / SCORE_DIMENSIONS.length);

  const rawSummary = reading.summary;
  const summary = typeof rawSummary === 'string' && rawSummary.trim().length > 0 ? rawSummary.trim() : '暂无点评。';

  const rawTips = reading.tips;
  const tips = Array.isArray(rawTips)
    ? rawTips.filter((tip): tip is string => typeof tip === 'string' && tip.trim().length > 0).slice(0, MAX_TIPS)
    : [];

  return { overall, dimensions, summary, tips };
}

// System prompt: the model acts as a photography critic. It sees one frame and
// returns five 0-100 scores plus a summary and up to three tips. It must not
// describe the photo in prose beyond the required fields.
export const SCORE_SYSTEM_PROMPT = [
  '你是一位摄影点评助手。分析这张照片，从五个维度打分（每个 0 到 100 的整数）：',
  ...SCORE_DIMENSIONS.map((key) => `${key}：${DIMENSION_HINTS[key]}。`),
  '另外给出一句总体点评 summary，以及 1 到 3 条可执行的改进建议 tips（每条一句话）。',
  '只返回 JSON：composition、lighting、color、sharpness、aesthetics 为 0 到 100 的整数；summary 为字符串；tips 为字符串数组。',
  '不要解释字段之外的内容，不要返回像素描述或相机参数。',
].join('\n');

export function buildScoreMessages(dataUrl: string): AIMessage[] {
  return [
    { role: 'system', content: SCORE_SYSTEM_PROMPT },
    { role: 'user', content: [
      { type: 'text', text: '给这张照片打分并给出改进建议。' },
      { type: 'image_url', image_url: { url: dataUrl } },
    ] },
  ];
}

export const SCORE_SCHEMA = {
  type: 'object',
  properties: {
    composition: { type: 'number', description: 'Composition score 0-100.' },
    lighting: { type: 'number', description: 'Lighting score 0-100.' },
    color: { type: 'number', description: 'Color score 0-100.' },
    sharpness: { type: 'number', description: 'Sharpness score 0-100.' },
    aesthetics: { type: 'number', description: 'Aesthetics score 0-100.' },
    summary: { type: 'string', description: 'One-line overall critique.' },
    tips: { type: 'array', items: { type: 'string' }, description: 'Up to three actionable improvement tips.' },
  },
  required: ['composition', 'lighting', 'color', 'sharpness', 'aesthetics', 'summary', 'tips'],
} as const;

// Grades one finished photo. Uses the same provider/config the guidance path
// already uses, with a JSON schema constraining the score set. The caller is
// responsible for failing open on rejection.
export async function scorePhoto(config: GuidanceConfig, dataUrl: string, signal: AbortSignal, timeoutMs = 15000): Promise<PhotoScore> {
  const result = await requestAICompletion(config.provider, config, buildScoreMessages(dataUrl), {
    signal, timeoutMs, json: true,
    outputSchema: { name: 'photo_score_v1', schema: SCORE_SCHEMA as unknown as object },
  });
  return normalizeScore(JSON.parse(result.content) as Record<string, unknown>);
}
