import { normalizeCompositions, buildCompositionMessages, COMPOSITION_SCHEMA, MAX_VARIANTS } from '../photoCompositions';

const validVariant = (over: Record<string, unknown> = {}) => ({
  label: '紧凑主体',
  centerX: 0.5,
  centerY: 0.5,
  width: 0.6,
  height: 0.6,
  rationale: '收紧到主体。',
  ...over,
});

const reading = (variants: unknown) => ({ variants });

describe('normalizeCompositions', () => {
  it('normalizes each variant box into range and keeps the label/rationale', () => {
    const out = normalizeCompositions(reading([validVariant({ centerX: 1.4, centerY: -0.2, width: 0.2, height: 2 })]));
    expect(out).toHaveLength(1);
    expect(out[0].label).toBe('紧凑主体');
    expect(out[0].box.centerX).toBe(1);
    expect(out[0].box.centerY).toBe(0);
    expect(out[0].box.width).toBe(0.3); // MIN_CROP floor
    expect(out[0].box.height).toBe(1);
    expect(out[0].rationale).toBe('收紧到主体。');
  });

  it('caps the variant count at MAX_VARIANTS', () => {
    const many = Array.from({ length: 6 }, (_, i) => validVariant({ label: `v${i}` }));
    expect(normalizeCompositions(reading(many))).toHaveLength(MAX_VARIANTS);
  });

  it('drops non-object and malformed variants', () => {
    const out = normalizeCompositions(reading([null, 'nope', validVariant(), 42]));
    expect(out).toHaveLength(1);
    expect(out[0].label).toBe('紧凑主体');
  });

  it('degrades a missing label to a placeholder and missing rationale to a default', () => {
    const out = normalizeCompositions(reading([validVariant({ label: '   ', rationale: '' })]));
    expect(out[0].label).toBe('构图方案');
    expect(out[0].rationale).toBe('已按构图优化裁剪。');
  });

  it('degrades a non-array variants field to a single default variant', () => {
    const out = normalizeCompositions({ variants: 'nope' });
    expect(out).toHaveLength(1);
    expect(out[0].label).toBe('构图方案');
    expect(out[0].box).toEqual({ centerX: 0.5, centerY: 0.5, width: 1, height: 1 });
  });

  it('falls back to a default variant when nothing usable remains', () => {
    const out = normalizeCompositions(reading([null, undefined]));
    expect(out).toHaveLength(1);
    expect(out[0].label).toBe('构图方案');
  });
});

describe('composition protocol', () => {
  it('builds messages with the image attached', () => {
    const msgs = buildCompositionMessages('data:image/jpeg;base64,abc');
    expect(msgs[0].role).toBe('system');
    expect(JSON.stringify(msgs[1].content)).toContain('data:image/jpeg;base64,abc');
  });

  it('constrains output via a variants array schema', () => {
    expect(COMPOSITION_SCHEMA.required).toContain('variants');
    expect(COMPOSITION_SCHEMA.properties.variants.type).toBe('array');
  });
});
