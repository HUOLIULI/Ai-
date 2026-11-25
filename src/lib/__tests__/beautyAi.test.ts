import { BEAUTY_SYSTEM_PROMPT, buildBeautyMessages, parseBeauty } from '../beautyAi';

describe('buildBeautyMessages', () => {
  it('includes the system prompt and a user turn with the frame image', () => {
    const messages = buildBeautyMessages('data:image/jpeg;base64,QUJD');
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toContain('美颜');
    expect(messages[1].role).toBe('user');
    const content = messages[1].content as { type: string }[];
    expect(content.some(part => part.type === 'image_url')).toBe(true);
  });
});

describe('parseBeauty', () => {
  it('parses a valid beauty payload', () => {
    const p = parseBeauty('{"smoothing":0.6,"brightening":0.2,"warmth":0.3}');
    expect(p).toEqual({ smoothing: 0.6, brightening: 0.2, warmth: 0.3 });
  });

  it('clamps out-of-range values', () => {
    const p = parseBeauty('{"smoothing":9,"brightening":-9,"warmth":9}');
    expect(p.smoothing).toBe(1);
    expect(p.brightening).toBe(0);
    expect(p.warmth).toBe(1);
  });

  it('throws on malformed JSON', () => {
    expect(() => parseBeauty('not json')).toThrow();
  });

  it('defaults missing fields to neutral', () => {
    const p = parseBeauty('{"smoothing":0.4}');
    expect(p.brightening).toBe(0);
    expect(p.warmth).toBe(0);
  });
});

describe('BEAUTY_SYSTEM_PROMPT', () => {
  it('instructs the model to return only the three bounded parameters', () => {
    expect(BEAUTY_SYSTEM_PROMPT).toContain('smoothing');
    expect(BEAUTY_SYSTEM_PROMPT).toContain('warmth');
  });
});
