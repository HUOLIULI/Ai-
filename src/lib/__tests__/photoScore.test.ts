import { normalizeScore, buildScoreMessages, SCORE_SCHEMA, SCORE_DIMENSIONS, DIMENSION_LABELS, scorePhoto } from '../photoScore';
import type { GuidanceConfig } from '../../types/guidance';

const config: GuidanceConfig = { provider: 'custom', apiKey: 'k', model: 'm', baseUrl: 'https://example.com/v1' };

function reading(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    composition: 80, lighting: 70, color: 75, sharpness: 90, aesthetics: 85,
    summary: '整体不错，构图可以再收紧一点。',
    tips: ['把主体往三分线上放。', '略欠曝，可提亮暗部。'],
    ...overrides,
  };
}

describe('normalizeScore', () => {
  it('derives overall as the rounded mean of the five dimensions', () => {
    const score = normalizeScore(reading());
    expect(score.dimensions).toEqual({ composition: 80, lighting: 70, color: 75, sharpness: 90, aesthetics: 85 });
    expect(score.overall).toBe(80); // (80+70+75+90+85)/5 = 80
  });

  it('clamps an out-of-range dimension into 0-100 and rounds it', () => {
    const score = normalizeScore(reading({ composition: 130, lighting: -5, color: 74.6 }));
    expect(score.dimensions.composition).toBe(100);
    expect(score.dimensions.lighting).toBe(0);
    expect(score.dimensions.color).toBe(75);
  });

  it('degrades a missing or non-numeric dimension to 0 rather than guessing', () => {
    const score = normalizeScore(reading({ sharpness: 'high', aesthetics: undefined }));
    expect(score.dimensions.sharpness).toBe(0);
    expect(score.dimensions.aesthetics).toBe(0);
  });

  it('keeps a non-finite dimension out of the score', () => {
    const score = normalizeScore(reading({ color: Number.NaN }));
    expect(score.dimensions.color).toBe(0);
  });

  it('falls back to a placeholder when the summary is missing or blank', () => {
    expect(normalizeScore(reading({ summary: undefined })).summary).toBe('暂无点评。');
    expect(normalizeScore(reading({ summary: '   ' })).summary).toBe('暂无点评。');
  });

  it('filters non-string and empty tips and caps the list at three', () => {
    const score = normalizeScore(reading({
      tips: ['有效建议', '', '   ', 42, '另一条', '第三条', '被截断'],
    }));
    expect(score.tips).toEqual(['有效建议', '另一条', '第三条']);
    expect(score.tips.length).toBeLessThanOrEqual(3);
  });

  it('returns an empty tips array when tips is not an array', () => {
    expect(normalizeScore(reading({ tips: 'nope' })).tips).toEqual([]);
  });
});

describe('buildScoreMessages', () => {
  it('carries the photo as an image_url and includes the dimension names', () => {
    const messages = buildScoreMessages('data:image/jpeg;base64,QUJD');
    expect(messages[0].role).toBe('system');
    expect(typeof messages[0].content).toBe('string');
    const system = messages[0].content as string;
    for (const dim of SCORE_DIMENSIONS) {
      expect(system).toContain(dim);
      expect(system).toContain(DIMENSION_LABELS[dim]);
    }
    const user = messages[1].content as Record<string, unknown>[];
    expect(user.some((part) => (part as { type: string }).type === 'image_url')).toBe(true);
  });
});

describe('SCORE_SCHEMA', () => {
  it('requires all five dimensions plus summary and tips', () => {
    for (const dim of SCORE_DIMENSIONS) {
      expect(SCORE_SCHEMA.required).toContain(dim);
    }
    expect(SCORE_SCHEMA.required).toContain('summary');
    expect(SCORE_SCHEMA.required).toContain('tips');
  });
});

describe('scorePhoto', () => {
  it('parses a valid model response into a PhotoScore', async () => {
    jest.spyOn(require('../aiClient'), 'requestAICompletion').mockResolvedValue({
      content: JSON.stringify(reading()),
    });
    const score = await scorePhoto(config, 'data:image/jpeg;base64,QUJD', new AbortController().signal);
    expect(score.overall).toBe(80);
    expect(score.dimensions.composition).toBe(80);
    expect(score.summary).toContain('构图');
    jest.restoreAllMocks();
  });
});
