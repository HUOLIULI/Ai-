import { planAutoEnhance, applyAutoEnhanceToPhoto } from '../autoEnhance';
import { getSceneAdvice } from '../sceneAdvice';
import { analyzeWhiteBalance, applyWbCorrectionToPhoto } from '../wbCorrection';
import { applyStyleFilterToPhoto } from '../../plugin/builtin';
import type { GuidanceConfig } from '../../types/guidance';

jest.mock('../sceneAdvice');
jest.mock('../wbCorrection');
jest.mock('../../plugin/builtin');

const mockedScene = getSceneAdvice as jest.MockedFunction<typeof getSceneAdvice>;
const mockedWb = analyzeWhiteBalance as jest.MockedFunction<typeof analyzeWhiteBalance>;
const mockedApplyWb = applyWbCorrectionToPhoto as jest.MockedFunction<typeof applyWbCorrectionToPhoto>;
const mockedApplyStyle = applyStyleFilterToPhoto as jest.MockedFunction<typeof applyStyleFilterToPhoto>;

const config: GuidanceConfig = { provider: 'custom', apiKey: 'k', model: 'm', baseUrl: 'https://example.com/v1' };
const advice = { scene: '逆光' as const, mode: '风景' as const, style: '清透' as const, exposureHint: '', rationale: '', confidence: 0.9 };
const wb = { cast: '偏暖' as const, exposure: '过曝' as const, severity: 0.6 };

describe('planAutoEnhance', () => {
  it('runs scene recognition and white-balance reading together', async () => {
    mockedScene.mockResolvedValue(advice);
    mockedWb.mockResolvedValue(wb);
    const plan = await planAutoEnhance(config, 'data:image/jpeg;base64,QUJD', new AbortController().signal);
    expect(plan.advice.style).toBe('清透');
    expect(plan.wb.cast).toBe('偏暖');
    expect(mockedScene).toHaveBeenCalledTimes(1);
    expect(mockedWb).toHaveBeenCalledTimes(1);
  });

  it('rejects if either model read fails', async () => {
    mockedScene.mockResolvedValue(advice);
    mockedWb.mockRejectedValue(new Error('wb down'));
    await expect(planAutoEnhance(config, 'data:image/jpeg;base64,QUJD', new AbortController().signal)).rejects.toThrow('wb down');
  });
});

describe('applyAutoEnhanceToPhoto', () => {
  it('applies the style LUT first, then the corrective grade on top', async () => {
    mockedApplyStyle.mockResolvedValue('file://styled.jpg');
    mockedApplyWb.mockResolvedValue('file://enhanced.jpg');
    const out = await applyAutoEnhanceToPhoto('file://src.jpg', { advice, wb }, {} as never, 0.75);
    expect(out).toBe('file://enhanced.jpg');
    expect(mockedApplyStyle).toHaveBeenCalledWith('file://src.jpg', '清透');
    expect(mockedApplyWb).toHaveBeenCalledWith('file://styled.jpg', wb, expect.anything(), 0.75);
  });

  it('chains the style result into the corrective pass', async () => {
    mockedApplyStyle.mockResolvedValue('file://styled.jpg');
    mockedApplyWb.mockResolvedValue('file://enhanced.jpg');
    await applyAutoEnhanceToPhoto('file://src.jpg', { advice, wb }, {} as never, 1);
    expect(mockedApplyWb.mock.calls[0][0]).toBe('file://styled.jpg');
  });

  it('propagates backend failures so callers can fail open', async () => {
    mockedApplyStyle.mockResolvedValue('file://styled.jpg');
    mockedApplyWb.mockRejectedValue(new Error('backend down'));
    await expect(applyAutoEnhanceToPhoto('file://src.jpg', { advice, wb }, {} as never, 1)).rejects.toThrow('backend down');
  });
});
