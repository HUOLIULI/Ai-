import { wbReadingToGrade, parseWbReading, analyzeWhiteBalance, applyWbCorrectionToPhoto, WB_SCHEMA } from '../wbCorrection';
import { requestAICompletion } from '../aiClient';
import { applyLutSpecToPhoto } from '../../plugin/builtin/filters';
import type { GuidanceConfig } from '../../types/guidance';

jest.mock('../aiClient');
jest.mock('../../plugin/builtin/filters');

const mockedRequest = requestAICompletion as jest.MockedFunction<typeof requestAICompletion>;
const mockedApply = applyLutSpecToPhoto as jest.MockedFunction<typeof applyLutSpecToPhoto>;

const config: GuidanceConfig = { provider: 'custom', apiKey: 'k', model: 'm', baseUrl: 'https://example.com/v1' };

describe('wbReadingToGrade', () => {
  it('returns a neutral grade when there is no problem', () => {
    expect(wbReadingToGrade({ cast: '无', exposure: '正常', severity: 0.8 }))
      .toEqual({ temperature: 0, exposure: 0, contrast: 0, saturation: 0, tint: 0 });
  });

  it('cools a warm cast with a negative temperature shift', () => {
    const g = wbReadingToGrade({ cast: '偏暖', exposure: '正常', severity: 1 });
    expect(g.temperature).toBeLessThan(0);
    expect(g.tint).toBe(0);
  });

  it('warms a cool cast with a positive temperature shift', () => {
    expect(wbReadingToGrade({ cast: '偏冷', exposure: '正常', severity: 1 }).temperature).toBeGreaterThan(0);
  });

  it('neutralises a green cast toward magenta (negative tint)', () => {
    expect(wbReadingToGrade({ cast: '偏绿', exposure: '正常', severity: 1 }).tint).toBeLessThan(0);
  });

  it('neutralises a magenta cast toward green (positive tint)', () => {
    expect(wbReadingToGrade({ cast: '偏品红', exposure: '正常', severity: 1 }).tint).toBeGreaterThan(0);
  });

  it('darkens an overexposed and brightens an underexposed frame', () => {
    expect(wbReadingToGrade({ cast: '无', exposure: '过曝', severity: 1 }).exposure).toBeLessThan(0);
    expect(wbReadingToGrade({ cast: '无', exposure: '欠曝', severity: 1 }).exposure).toBeGreaterThan(0);
  });

  it('scales the correction by severity', () => {
    const strong = wbReadingToGrade({ cast: '偏暖', exposure: '正常', severity: 1 });
    const mild = wbReadingToGrade({ cast: '偏暖', exposure: '正常', severity: 0.5 });
    expect(Math.abs(mild.temperature)).toBeCloseTo(Math.abs(strong.temperature) * 0.5);
  });

  it('keeps contrast and saturation neutral (correct, not restyle)', () => {
    const g = wbReadingToGrade({ cast: '偏暖', exposure: '欠曝', severity: 1 });
    expect(g.contrast).toBe(0);
    expect(g.saturation).toBe(0);
  });
});

describe('parseWbReading', () => {
  it('parses a valid reading', () => {
    const r = parseWbReading('{"cast":"偏暖","exposure":"过曝","severity":0.6}');
    expect(r).toEqual({ cast: '偏暖', exposure: '过曝', severity: 0.6 });
  });

  it('clamps an out-of-range severity', () => {
    expect(parseWbReading('{"cast":"无","exposure":"正常","severity":9}').severity).toBe(1);
  });

  it('degrades unknown cast/exposure to no-problem', () => {
    const r = parseWbReading('{"cast":"太黄","exposure":"很暗","severity":0.5}');
    expect(r.cast).toBe('无');
    expect(r.exposure).toBe('正常');
  });

  it('defaults a missing severity to zero', () => {
    expect(parseWbReading('{"cast":"偏暖","exposure":"正常"}').severity).toBe(0);
  });
});

describe('analyzeWhiteBalance', () => {
  it('returns the parsed reading on success', async () => {
    mockedRequest.mockResolvedValue({ content: '{"cast":"偏冷","exposure":"欠曝","severity":0.4}', elapsedMs: 5 });
    const r = await analyzeWhiteBalance(config, 'data:image/jpeg;base64,QUJD', new AbortController().signal);
    expect(r).toEqual({ cast: '偏冷', exposure: '欠曝', severity: 0.4 });
  });

  it('rejects when the model call fails', async () => {
    mockedRequest.mockRejectedValue(new Error('boom'));
    await expect(analyzeWhiteBalance(config, 'data:image/jpeg;base64,QUJD', new AbortController().signal)).rejects.toThrow('boom');
  });

  it('exposes a bounded schema constraining cast and exposure', () => {
    expect(WB_SCHEMA.properties.cast.enum).toContain('偏暖');
    expect(WB_SCHEMA.required).toEqual(['cast', 'exposure', 'severity']);
  });
});

describe('applyWbCorrectionToPhoto', () => {
  it('compiles the corrective grade to a LUT and applies it', async () => {
    mockedApply.mockResolvedValue('file://corrected.jpg');
    const out = await applyWbCorrectionToPhoto('file://src.jpg', { cast: '偏暖', exposure: '正常', severity: 0.5 }, {} as never);
    expect(out).toBe('file://corrected.jpg');
    expect(mockedApply).toHaveBeenCalledWith('file://src.jpg', expect.objectContaining({ name: 'ai-color-grade' }), expect.anything());
  });

  it('propagates backend failures so callers can fail open', async () => {
    mockedApply.mockRejectedValue(new Error('backend down'));
    await expect(applyWbCorrectionToPhoto('file://src.jpg', { cast: '无', exposure: '正常', severity: 0 }, {} as never)).rejects.toThrow('backend down');
  });
});
