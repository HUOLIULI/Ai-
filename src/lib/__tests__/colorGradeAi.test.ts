import { COLOR_GRADE_SYSTEM_PROMPT, buildColorGradeMessages, parseColorGrade } from '../colorGradeAi';

describe('buildColorGradeMessages', () => {
  it('includes the system prompt and a user turn with the frame image', () => {
    const messages = buildColorGradeMessages('data:image/jpeg;base64,QUJD');
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toContain('调色');
    expect(messages[1].role).toBe('user');
    const content = messages[1].content as { type: string }[];
    expect(content.some(part => part.type === 'image_url')).toBe(true);
  });
});

describe('parseColorGrade', () => {
  it('parses a valid color-grade payload', () => {
    const p = parseColorGrade('{"temperature":0.2,"exposure":-0.1,"contrast":0.3,"saturation":0.4,"tint":0}');
    expect(p).toEqual({ temperature: 0.2, exposure: -0.1, contrast: 0.3, saturation: 0.4, tint: 0 });
  });

  it('clamps out-of-range values', () => {
    const p = parseColorGrade('{"temperature":9,"exposure":-9,"contrast":0,"saturation":0,"tint":0}');
    expect(p.temperature).toBe(1);
    expect(p.exposure).toBe(-1);
  });

  it('throws on malformed JSON', () => {
    expect(() => parseColorGrade('not json')).toThrow();
  });

  it('defaults missing fields to neutral', () => {
    const p = parseColorGrade('{"temperature":0.1}');
    expect(p.exposure).toBe(0);
    expect(p.contrast).toBe(0);
    expect(p.saturation).toBe(0);
    expect(p.tint).toBe(0);
  });
});

describe('COLOR_GRADE_SYSTEM_PROMPT', () => {
  it('instructs the model to return only the five bounded parameters', () => {
    expect(COLOR_GRADE_SYSTEM_PROMPT).toContain('temperature');
    expect(COLOR_GRADE_SYSTEM_PROMPT).toContain('-1');
    expect(COLOR_GRADE_SYSTEM_PROMPT).toContain('1');
  });
});
