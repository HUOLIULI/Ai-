import { requestAICompletion, type AIMessage } from './aiClient';
import type { GuidanceConfig } from '../types/guidance';
import { SCENE_LABELS, SCENE_SCHEMA, normalizeScene, type SceneReading } from './sceneRecognition';

// System prompt: the model acts as a scene classifier. It sees one frame and
// returns a single scene label plus a confidence; the client maps that label
// onto camera settings. It must not describe the scene in prose.
export const SCENE_SYSTEM_PROMPT = [
  `你是一位摄影场景识别助手。分析这张照片，判断它属于以下哪一类场景：${SCENE_LABELS.join('、')}。`,
  '只返回两个字段的 JSON：',
  'scene：场景标签，必须是上面列出的其中之一；',
  'confidence：判断置信度，0 到 1 的数字。',
  '不要解释，不要返回文字描述或相机参数。',
].join('\n');

export function buildSceneMessages(dataUrl: string): AIMessage[] {
  return [
    { role: 'system', content: SCENE_SYSTEM_PROMPT },
    { role: 'user', content: [
      { type: 'text', text: '识别这张照片的场景类型。' },
      { type: 'image_url', image_url: { url: dataUrl } },
    ] },
  ];
}

export function parseScene(content: string): SceneReading {
  const raw = JSON.parse(content) as Record<string, unknown>;
  const label = typeof raw.scene === 'string' ? raw.scene : '';
  const confidence = typeof raw.confidence === 'number' ? raw.confidence : undefined;
  return normalizeScene(label, confidence);
}

// Classifies the scene for one frame. Uses the same provider/config the
// guidance path already uses, with a JSON schema constraining the label set.
export async function recognizeScene(config: GuidanceConfig, dataUrl: string, signal: AbortSignal, timeoutMs = 15000): Promise<SceneReading> {
  const result = await requestAICompletion(config.provider, config, buildSceneMessages(dataUrl), {
    signal, timeoutMs, json: true,
    outputSchema: { name: 'camera_scene_v1', schema: SCENE_SCHEMA as unknown as object },
  });
  return parseScene(result.content);
}
