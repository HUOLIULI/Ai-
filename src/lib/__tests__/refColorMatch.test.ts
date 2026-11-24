import { REFERENCE_GRADE_SYSTEM_PROMPT, buildReferenceGradeMessages, applyReferenceGradeToPhoto, analyzeReferenceGrade } from '../refColorMatch';
import { requestAICompletion } from '../aiClient';
import { applyLutSpecToPhoto } from '../../plugin/builtin/filters';
import type { GuidanceConfig } from '../../types/guidance';

jest.mock('../aiClient');
jest.mock('../../plugin/builtin/filters');

const mockedRequest = requestAICompletion as jest.MockedFunction<typeof requestAICompletion>;
const mockedApply = applyLutSpecToPhoto as jest.MockedFunction<typeof applyLutSpecToPhoto>;

const config: GuidanceConfig = { provider: 'custom', apiKey: 'k', model: 'm', baseUrl: 'https://example.com/v1' };
const source = 'data:image/jpeg;base64,QUJD';
const reference = 'data:image/jpeg;base64,REFG';

describe('buildReferenceGradeMessages', () => {
  it('places the source image before the reference image in one user turn', () => {
    const messages = buildReferenceGradeMessages(source, reference);
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toContain('参考图');
    expect(messages[1].role).toBe('user');
    const content = messages[1].content as { type: string; image_url?: { url: string } }[];
    const images = content.filter(part => part.type === 'image_url');
    expect(images).toHaveLength(2);
    expect(images[0].image_url?.url).toBe(source);
    expect(images[1].image_url?.url).toBe(reference);
  });

  it('documents the source/reference order in the system prompt', () => {
    expect(REFERENCE_GRADE_SYSTEM_PROMPT).toContain('第一张');
    expect(REFERENCE_GRADE_SYSTEM_PROMPT).toContain('第二张');
  });
});

describe('analyzeReferenceGrade', () => {
  it('returns the parsed color-grade parameters on success', async () => {
    mockedRequest.mockResolvedValue({ content: '{"temperature":0.3,"exposure":-0.2,"contrast":0.5,"saturation":0.4,"tint":0}', elapsedMs: 5 });
    const p = await analyzeReferenceGrade(config, source, reference, new AbortController().signal);
    expect(p).toEqual({ temperature: 0.3, exposure: -0.2, contrast: 0.5, saturation: 0.4, tint: 0 });
    expect(mockedRequest).toHaveBeenCalledTimes(1);
  });

  it('rejects when the model call fails', async () => {
    mockedRequest.mockRejectedValue(new Error('boom'));
    await expect(analyzeReferenceGrade(config, source, reference, new AbortController().signal)).rejects.toThrow('boom');
  });
});

describe('applyReferenceGradeToPhoto', () => {
  it('compiles params to a LUT and applies it through the backend', async () => {
    mockedApply.mockResolvedValue('file://matched.jpg');
    const out = await applyReferenceGradeToPhoto('file://src.jpg', { temperature: 0.2 }, {} as never);
    expect(out).toBe('file://matched.jpg');
    expect(mockedApply).toHaveBeenCalledWith('file://src.jpg', expect.objectContaining({ name: 'ai-color-grade' }), expect.anything());
  });

  it('propagates backend failures so callers can fail open', async () => {
    mockedApply.mockRejectedValue(new Error('backend down'));
    await expect(applyReferenceGradeToPhoto('file://src.jpg', {}, {} as never)).rejects.toThrow('backend down');
  });
});
