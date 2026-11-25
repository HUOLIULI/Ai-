import { normalizeCrop, cropBoxToRect, buildCropMessages, CROP_SCHEMA, suggestCrop, MIN_CROP } from '../photoCrop';
import type { GuidanceConfig } from '../../types/guidance';

const config: GuidanceConfig = { provider: 'custom', apiKey: 'k', model: 'm', baseUrl: 'https://example.com/v1' };

function reading(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    centerX: 0.5, centerY: 0.45, width: 0.8, height: 0.7,
    rationale: '主体偏左，向左收紧构图。',
    ...overrides,
  };
}

describe('normalizeCrop', () => {
  it('keeps a valid box and rationale unchanged', () => {
    const { box, rationale } = normalizeCrop(reading());
    expect(box).toEqual({ centerX: 0.5, centerY: 0.45, width: 0.8, height: 0.7 });
    expect(rationale).toContain('主体');
  });

  it('clamps out-of-range fields into 0-1', () => {
    const { box } = normalizeCrop(reading({ centerX: 1.4, centerY: -0.2, width: 1.5, height: 0.9 }));
    expect(box.centerX).toBe(1);
    expect(box.centerY).toBe(0);
    expect(box.width).toBe(1);
    expect(box.height).toBe(0.9);
  });

  it('degrades a missing or non-numeric field to 0 (center) or the MIN_CROP floor (size)', () => {
    const { box } = normalizeCrop(reading({ centerX: 'left', height: undefined }));
    expect(box.centerX).toBe(0);
    expect(box.height).toBe(MIN_CROP);
  });

  it('floors the crop size at MIN_CROP so the frame keeps area', () => {
    const { box } = normalizeCrop(reading({ width: 0.05, height: 0 }));
    expect(box.width).toBe(MIN_CROP);
    expect(box.height).toBe(MIN_CROP);
  });

  it('falls back to a placeholder when the rationale is missing or blank', () => {
    expect(normalizeCrop(reading({ rationale: undefined })).rationale).toContain('裁剪');
    expect(normalizeCrop(reading({ rationale: '   ' })).rationale).toContain('裁剪');
  });
});

describe('cropBoxToRect', () => {
  it('centers the rect for a centered box', () => {
    const rect = cropBoxToRect({ centerX: 0.5, centerY: 0.5, width: 0.5, height: 0.5 }, 1000, 800);
    expect(rect.width).toBe(500);
    expect(rect.height).toBe(400);
    expect(rect.originX).toBe(250);
    expect(rect.originY).toBe(200);
  });

  it('clamps the origin so the rect stays inside the image', () => {
    // A box centered near the left edge must not produce a negative origin.
    const rect = cropBoxToRect({ centerX: 0.1, centerY: 0.1, width: 0.5, height: 0.5 }, 1000, 800);
    expect(rect.originX).toBe(0);
    expect(rect.originY).toBe(0);
  });

  it('clamps the origin so the rect does not run past the right/bottom edge', () => {
    const rect = cropBoxToRect({ centerX: 0.95, centerY: 0.95, width: 0.5, height: 0.5 }, 1000, 800);
    expect(rect.originX + rect.width).toBeLessThanOrEqual(1000);
    expect(rect.originY + rect.height).toBeLessThanOrEqual(800);
  });

  it('always yields a rect of at least 1px', () => {
    const rect = cropBoxToRect({ centerX: 0.5, centerY: 0.5, width: MIN_CROP, height: MIN_CROP }, 10, 10);
    expect(rect.width).toBeGreaterThanOrEqual(1);
    expect(rect.height).toBeGreaterThanOrEqual(1);
  });
});

describe('buildCropMessages', () => {
  it('carries the photo as an image_url and asks for a crop', () => {
    const messages = buildCropMessages('data:image/jpeg;base64,QUJD');
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toContain('裁剪');
    const user = messages[1].content as Record<string, unknown>[];
    expect(user.some((part) => (part as { type: string }).type === 'image_url')).toBe(true);
  });
});

describe('CROP_SCHEMA', () => {
  it('requires the box fields plus rationale', () => {
    for (const key of ['centerX', 'centerY', 'width', 'height', 'rationale']) {
      expect(CROP_SCHEMA.required).toContain(key);
    }
  });
});

describe('suggestCrop', () => {
  it('parses a valid model response into a CropSuggestion', async () => {
    jest.spyOn(require('../aiClient'), 'requestAICompletion').mockResolvedValue({
      content: JSON.stringify(reading()),
    });
    const suggestion = await suggestCrop(config, 'data:image/jpeg;base64,QUJD', new AbortController().signal);
    expect(suggestion.box.width).toBe(0.8);
    expect(suggestion.rationale).toContain('主体');
    jest.restoreAllMocks();
  });
});
