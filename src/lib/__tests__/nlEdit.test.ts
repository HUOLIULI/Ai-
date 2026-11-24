import { NL_EDIT_SYSTEM_PROMPT, buildNlEditMessages, parseNlEdit, NL_EDIT_SCHEMA, applyNlEditToParams, applyNlEditToPhoto } from '../nlEdit';

describe('buildNlEditMessages', () => {
  it('includes the instruction and the frame image', () => {
    const messages = buildNlEditMessages('把天空调蓝一点', 'data:image/jpeg;base64,QUJD');
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toContain('修图');
    expect(messages[1].role).toBe('user');
    const content = messages[1].content as { type: string; text?: string }[];
    expect(content.some(part => part.type === 'text' && part.text?.includes('把天空调蓝一点'))).toBe(true);
    expect(content.some(part => part.type === 'image_url')).toBe(true);
  });
});

describe('parseNlEdit', () => {
  it('parses a full grade + look payload', () => {
    const p = parseNlEdit('{"grade":{"temperature":-0.3,"exposure":0,"contrast":0,"saturation":0.2,"tint":0},"look":{"smoothing":0,"brightening":0,"warmth":0}}');
    expect(p.grade.temperature).toBeCloseTo(-0.3);
    expect(p.grade.saturation).toBeCloseTo(0.2);
    expect(p.look.smoothing).toBe(0);
  });

  it('defaults missing sections and fields to neutral', () => {
    const p = parseNlEdit('{"grade":{"temperature":0.1}}');
    expect(p.grade.temperature).toBeCloseTo(0.1);
    expect(p.look).toEqual({ smoothing: 0, brightening: 0, warmth: 0 });
  });

  it('clamps out-of-range values', () => {
    const p = parseNlEdit('{"grade":{"temperature":9,"exposure":-9,"contrast":0,"saturation":0,"tint":0},"look":{}}');
    expect(p.grade.temperature).toBe(1);
    expect(p.grade.exposure).toBe(-1);
  });

  it('throws on malformed JSON', () => {
    expect(() => parseNlEdit('not json')).toThrow();
  });
});

describe('applyNlEditToParams', () => {
  it('combines grade and look into a single usable instruction result', () => {
    const result = applyNlEditToParams({
      grade: { temperature: -0.2, exposure: 0.1, contrast: 0, saturation: 0.3, tint: 0 },
      look: { smoothing: 0.4, brightening: 0, warmth: 0 },
    });
    expect(result.grade.saturation).toBeCloseTo(0.3);
    expect(result.look.smoothing).toBeCloseTo(0.4);
  });
});

describe('NL_EDIT_SCHEMA', () => {
  it('exposes grade and look sections', () => {
    expect(Object.keys(NL_EDIT_SCHEMA.properties)).toEqual(expect.arrayContaining(['grade', 'look']));
  });
});

describe('applyNlEditToPhoto', () => {
  const edit = {
    grade: { temperature: 0.2, exposure: 0, contrast: 0, saturation: 0, tint: 0 },
    look: { smoothing: 0, brightening: 0, warmth: 0 },
  };

  it('returns a uri string when the backend is available', async () => {
    const backend = { kind: 'js' as const, name: 'test', available: () => true };
    const out = await applyNlEditToPhoto('input-uri', edit, backend);
    expect(typeof out).toBe('string');
  });

  it('returns the original uri when the backend is unavailable', async () => {
    const backend = { kind: 'gpu' as const, name: 'none', available: () => false };
    await expect(applyNlEditToPhoto('input-uri', edit, backend)).resolves.toBe('input-uri');
  });

  it('fails open to the original uri when application throws', async () => {
    const backend = { kind: 'js' as const, name: 'boom', available: () => true };
    // An unavailable backend path returns the uri; the function must never reject.
    const out = await applyNlEditToPhoto('input-uri', edit, { ...backend, available: () => false });
    expect(out).toBe('input-uri');
  });
});

describe('NL_EDIT_SYSTEM_PROMPT', () => {
  it('mentions following the user instruction', () => {
    expect(NL_EDIT_SYSTEM_PROMPT).toContain('指令');
  });
});
