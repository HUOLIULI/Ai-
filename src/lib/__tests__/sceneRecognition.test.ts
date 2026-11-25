import { SCENE_LABELS, sceneToRecommendation, normalizeScene, SCENE_SCHEMA } from '../sceneRecognition';

describe('normalizeScene', () => {
  it('keeps a known scene label', () => {
    expect(normalizeScene('人像')).toEqual({ scene: '人像', confidence: 1 });
  });

  it('falls back to a default scene for an unknown label', () => {
    const r = normalizeScene('外星基地');
    expect(SCENE_LABELS).toContain(r.scene);
  });

  it('clamps confidence into [0, 1]', () => {
    expect(normalizeScene('夜景', 9).confidence).toBe(1);
    expect(normalizeScene('夜景', -9).confidence).toBe(0);
  });

  it('treats non-finite confidence as neutral', () => {
    expect(normalizeScene('夜景', NaN).confidence).toBe(0);
  });
});

describe('sceneToRecommendation', () => {
  it('maps portrait scenes to the portrait mode and a portrait style', () => {
    const rec = sceneToRecommendation('人像');
    expect(rec.mode).toBe('人像');
  });

  it('maps landscape scenes to the landscape mode', () => {
    expect(sceneToRecommendation('风景').mode).toBe('风景');
  });

  it('maps night scenes to the night mode', () => {
    expect(sceneToRecommendation('夜景').mode).toBe('夜景');
  });

  it('maps food scenes to a vivid style and keeps a usable mode', () => {
    const rec = sceneToRecommendation('美食');
    expect(rec.mode).toBe('风景');
    expect(rec.style).toBeDefined();
  });

  it('maps backlit scenes and recommends HDR-friendly exposure', () => {
    const rec = sceneToRecommendation('逆光');
    expect(rec.exposureHint).toBeTruthy();
  });

  it('always returns a valid mode and style for every scene', () => {
    for (const scene of SCENE_LABELS) {
      const rec = sceneToRecommendation(scene);
      expect(['人像', '风景', '夜景']).toContain(rec.mode);
      expect(rec.style).toBeDefined();
      expect(rec.rationale).toBeTruthy();
    }
  });
});

describe('SCENE_SCHEMA', () => {
  it('exposes scene and confidence', () => {
    expect(Object.keys(SCENE_SCHEMA.properties)).toEqual(expect.arrayContaining(['scene', 'confidence']));
  });
});
