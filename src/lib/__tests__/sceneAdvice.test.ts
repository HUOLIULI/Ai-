import { getSceneAdvice, applySceneAdviceToPhoto } from '../sceneAdvice';
import { recognizeScene } from '../sceneAi';
import { applyStyleFilterToPhoto } from '../../plugin/builtin';
import type { GuidanceConfig } from '../../types/guidance';

jest.mock('../sceneAi');
jest.mock('../../plugin/builtin');

const mockedRecognize = recognizeScene as jest.MockedFunction<typeof recognizeScene>;
const mockedApplyStyle = applyStyleFilterToPhoto as jest.MockedFunction<typeof applyStyleFilterToPhoto>;

const config: GuidanceConfig = { provider: 'custom', apiKey: 'k', model: 'm', baseUrl: 'https://example.com/v1' };

describe('getSceneAdvice', () => {
  it('maps a recognized scene onto the matching style recommendation', async () => {
    mockedRecognize.mockResolvedValue({ scene: '逆光', confidence: 0.9 });
    const advice = await getSceneAdvice(config, 'data:image/jpeg;base64,QUJD', new AbortController().signal);
    expect(advice.scene).toBe('逆光');
    expect(advice.style).toBe('清透');
    expect(advice.confidence).toBe(0.9);
    expect(advice.rationale).toContain('逆光');
  });

  it('carries the classifier confidence through unchanged', async () => {
    mockedRecognize.mockResolvedValue({ scene: '美食', confidence: 0.55 });
    const advice = await getSceneAdvice(config, 'data:image/jpeg;base64,QUJD', new AbortController().signal);
    expect(advice.confidence).toBe(0.55);
    expect(advice.style).toBe('薄荷');
  });

  it('rejects when scene recognition fails', async () => {
    mockedRecognize.mockRejectedValue(new Error('boom'));
    await expect(getSceneAdvice(config, 'data:image/jpeg;base64,QUJD', new AbortController().signal)).rejects.toThrow('boom');
  });
});

describe('applySceneAdviceToPhoto', () => {
  it('applies the recommended style filter to the photo', async () => {
    mockedApplyStyle.mockResolvedValue('file://styled.jpg');
    const out = await applySceneAdviceToPhoto('file://src.jpg', {
      scene: '风景', mode: '风景', style: '清透', exposureHint: '', rationale: '', confidence: 0.9,
    });
    expect(out).toBe('file://styled.jpg');
    expect(mockedApplyStyle).toHaveBeenCalledWith('file://src.jpg', '清透');
  });
});
