import { Image } from 'react-native';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { requestAICompletion, type AIMessage } from './aiClient';
import type { GuidanceConfig } from '../types/guidance';

// AI smart crop. The vision model looks at a finished photo and proposes a
// normalized crop box (center + size as fractions of the frame) that improves
// the composition; we compile that box to a pixel rect and crop with
// expo-image-manipulator so an off-composition shot can be reframed. Pure
// normalization here; a failed call fails open at the caller.

// Smallest crop we allow, as a fraction of the source dimension, so the model
// can't collapse the frame to a sliver.
export const MIN_CROP = 0.3;

export type CropBox = { centerX: number; centerY: number; width: number; height: number };
export type CropRect = { originX: number; originY: number; width: number; height: number };
export type CropSuggestion = { box: CropBox; rationale: string };

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

// Normalizes one model reading into a CropSuggestion. Untrusted numbers are
// clamped to 0..1; the crop size is additionally floored at MIN_CROP so the
// frame keeps meaningful area. A missing rationale falls back to a placeholder.
export function normalizeCrop(reading: Record<string, unknown>): CropSuggestion {
  const num = (key: string): number => {
    const raw = reading[key];
    return typeof raw === 'number' && Number.isFinite(raw) ? clamp01(raw) : 0;
  };
  const width = Math.max(MIN_CROP, num('width'));
  const height = Math.max(MIN_CROP, num('height'));
  const box: CropBox = { centerX: num('centerX'), centerY: num('centerY'), width, height };

  const rawRationale = reading.rationale;
  const rationale = typeof rawRationale === 'string' && rawRationale.trim().length > 0 ? rawRationale.trim() : '已按构图优化裁剪。';

  return { box, rationale };
}

// Compiles a normalized crop box to a pixel rect clamped inside the image, so
// the crop never runs past an edge regardless of where the model centered it.
export function cropBoxToRect(box: CropBox, imageWidth: number, imageHeight: number): CropRect {
  const cropWidth = Math.max(1, Math.round(box.width * imageWidth));
  const cropHeight = Math.max(1, Math.round(box.height * imageHeight));
  const originX = Math.max(0, Math.min(imageWidth - cropWidth, Math.round(box.centerX * imageWidth - cropWidth / 2)));
  const originY = Math.max(0, Math.min(imageHeight - cropHeight, Math.round(box.centerY * imageHeight - cropHeight / 2)));
  return { originX, originY, width: cropWidth, height: cropHeight };
}

// Cross-platform image pixel size. Resolves via Image.getSize so it works on
// native and web; rejects so the caller can fail open on a bad uri.
export function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => {
        if (width > 0 && height > 0) resolve({ width, height });
        else reject(new Error('图片尺寸无效。'));
      },
      () => reject(new Error('无法读取图片尺寸。')),
    );
  });
}

// System prompt: the model acts as a cropping assistant. It sees one frame and
// returns a normalized crop box that tightens the composition on the main
// subject, plus a one-line reason. It must not describe the photo in prose
// beyond the required fields.
export const CROP_SYSTEM_PROMPT = [
  '你是一位摄影裁剪助手。分析这张照片，给出一个更出片的裁剪建议：以画面主体为中心收紧构图。',
  '只返回 JSON，字段如下（全部为 0 到 1 的归一化比例）：',
  'centerX、centerY：裁剪框中心在原图中的归一化位置（左上为 0,0，右下为 1,1）；',
  'width、height：裁剪框占原图宽高的比例（建议不小于 0.3，保留足够画面）；',
  'rationale：一句中文说明为什么这样裁。',
  '不要解释字段之外的内容，不要返回像素坐标或相机参数。',
].join('\n');

export function buildCropMessages(dataUrl: string): AIMessage[] {
  return [
    { role: 'system', content: CROP_SYSTEM_PROMPT },
    { role: 'user', content: [
      { type: 'text', text: '给这张照片一个更好的裁剪建议。' },
      { type: 'image_url', image_url: { url: dataUrl } },
    ] },
  ];
}

export const CROP_SCHEMA = {
  type: 'object',
  properties: {
    centerX: { type: 'number', description: 'Normalized crop center X, 0-1.' },
    centerY: { type: 'number', description: 'Normalized crop center Y, 0-1.' },
    width: { type: 'number', description: 'Crop width as a fraction of the source width, 0-1.' },
    height: { type: 'number', description: 'Crop height as a fraction of the source height, 0-1.' },
    rationale: { type: 'string', description: 'One-line reason for the crop.' },
  },
  required: ['centerX', 'centerY', 'width', 'height', 'rationale'],
} as const;

// Asks the model for a crop suggestion. Uses the same provider/config the
// guidance path already uses, with a JSON schema constraining the box.
export async function suggestCrop(config: GuidanceConfig, dataUrl: string, signal: AbortSignal, timeoutMs = 15000): Promise<CropSuggestion> {
  const result = await requestAICompletion(config.provider, config, buildCropMessages(dataUrl), {
    signal, timeoutMs, json: true,
    outputSchema: { name: 'photo_crop_v1', schema: CROP_SCHEMA as unknown as object },
  });
  return normalizeCrop(JSON.parse(result.content) as Record<string, unknown>);
}

// Crops the photo to the pixel rect via expo-image-manipulator and returns the
// new uri. The caller is responsible for failing open on rejection.
export async function applyCropToPhoto(uri: string, rect: CropRect): Promise<string> {
  const result = await manipulateAsync(uri, [{ crop: rect }], { compress: 0.95, format: SaveFormat.JPEG });
  return result.uri;
}
