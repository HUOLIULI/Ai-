import { requestAICompletion, type AIMessage } from './aiClient';
import type { GuidanceConfig } from '../types/guidance';
import { colorGradeParamsToLut, normalizeColorGrade, type ColorGradeParams } from './colorGrade';
import { scaleColorGrade } from './intensity';
import { applyLutSpecToPhoto } from '../plugin/builtin/filters';
import type { FilterBackend } from '../plugin/types';

// Corrective white-balance / exposure pass. Unlike the aesthetic "colorist"
// grade, this detects a colour cast and an exposure error and returns the
// counter-shift that neutralises them — "enhance, don't transform". The model
// reads the frame and reports the cast, the exposure error, and a severity; a
// pure mapping turns that into the corrective grade parameters applied as a LUT.

export const WB_CASTS = ['偏暖', '偏冷', '偏绿', '偏品红', '无'] as const;
export type WbCast = typeof WB_CASTS[number];

export const WB_EXPOSURES = ['过曝', '欠曝', '正常'] as const;
export type WbExposure = typeof WB_EXPOSURES[number];

export type WbReading = { cast: WbCast; exposure: WbExposure; severity: number };

// How strongly a detected problem maps onto the corrective grade at full
// severity. Kept below 1 so the correction pulls toward neutral without
// over-shooting and introducing the opposite cast.
const CORRECTION_GAIN = 0.8;

// Maps a white-balance reading onto corrective grade parameters. Each cast is
// neutralised by its opposite sign (warm<-cool, green<-magenta via tint), and an
// exposure error by a lift or drop. contrast/saturation stay at 0: this pass
// corrects, it does not restyle.
export function wbReadingToGrade(reading: WbReading): ColorGradeParams {
  const s = Math.max(0, Math.min(1, reading.severity)) * CORRECTION_GAIN;
  let temperature = 0;
  let tint = 0;
  switch (reading.cast) {
    case '偏暖': temperature = -s; break;
    case '偏冷': temperature = s; break;
    case '偏绿': tint = -s; break;
    case '偏品红': tint = s; break;
    default: break;
  }
  let exposure = 0;
  if (reading.exposure === '过曝') exposure = -s;
  else if (reading.exposure === '欠曝') exposure = s;
  return normalizeColorGrade({ temperature, exposure, contrast: 0, saturation: 0, tint });
}

export function buildWbMessages(dataUrl: string): AIMessage[] {
  return [
    { role: 'system', content: WB_SYSTEM_PROMPT },
    { role: 'user', content: [
      { type: 'text', text: '分析这张照片的白平衡与曝光，返回校正参数。' },
      { type: 'image_url', image_url: { url: dataUrl } },
    ] },
  ];
}

export const WB_SYSTEM_PROMPT = [
  '你是一位色彩校正师。分析这张照片是否存在色偏和曝光问题，只返回一组校正参数。',
  'cast：色偏，取值只能是 偏暖 / 偏冷 / 偏绿 / 偏品红 / 无；',
  'exposure：曝光，取值只能是 过曝 / 欠曝 / 正常；',
  'severity：问题的严重程度，0 到 1 之间的数字，没有问题时为 0。',
  '只返回 cast、exposure、severity 的 JSON，不要解释，不要返回文字或像素值。',
].join('\n');

export const WB_SCHEMA = {
  type: 'object',
  properties: {
    cast: { type: 'string', enum: [...WB_CASTS], description: 'The detected colour cast.' },
    exposure: { type: 'string', enum: [...WB_EXPOSURES], description: 'The detected exposure error.' },
    severity: { type: 'number', description: 'How strong the problem is, 0 to 1.' },
  },
  required: ['cast', 'exposure', 'severity'],
} as const;

function pickEnum<T extends readonly string[]>(value: unknown, allowed: T, fallback: T[number]): T[number] {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? value as T[number] : fallback;
}

// Parses the model's white-balance reading, degrading to "no problem" on any
// unknown cast/exposure so a malformed payload corrects nothing.
export function parseWbReading(content: string): WbReading {
  const raw = JSON.parse(content) as Record<string, unknown>;
  const severityRaw = raw.severity;
  const severity = typeof severityRaw === 'number' && Number.isFinite(severityRaw)
    ? Math.max(0, Math.min(1, severityRaw)) : 0;
  return {
    cast: pickEnum(raw.cast, WB_CASTS, '无'),
    exposure: pickEnum(raw.exposure, WB_EXPOSURES, '正常'),
    severity,
  };
}

export async function analyzeWhiteBalance(config: GuidanceConfig, dataUrl: string, signal: AbortSignal, timeoutMs = 20000): Promise<WbReading> {
  const result = await requestAICompletion(config.provider, config, buildWbMessages(dataUrl), {
    signal, timeoutMs, json: true,
    outputSchema: { name: 'camera_wb_correction_v1', schema: WB_SCHEMA as unknown as object },
  });
  return parseWbReading(result.content);
}

// Applies the corrective grade for a white-balance reading to the photo via the
// shared LUT engine. `strength` (0..1) dials the correction toward neutral, so
// this pass honours the same strength control as the other enhancements. Fails
// open — a backend error propagates to the caller and the source photo is kept.
export async function applyWbCorrectionToPhoto(uri: string, reading: WbReading, backend: FilterBackend, strength = 1): Promise<string> {
  const lut = colorGradeParamsToLut(scaleColorGrade(wbReadingToGrade(reading), strength));
  return applyLutSpecToPhoto(uri, lut, backend);
}
