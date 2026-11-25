import { SCENE_SYSTEM_PROMPT, buildSceneMessages, parseScene } from '../sceneAi';

describe('buildSceneMessages', () => {
  it('includes the system prompt and a user turn with the frame image', () => {
    const messages = buildSceneMessages('data:image/jpeg;base64,QUJD');
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toContain('场景');
    expect(messages[1].role).toBe('user');
    const content = messages[1].content as { type: string }[];
    expect(content.some(part => part.type === 'image_url')).toBe(true);
  });
});

describe('parseScene', () => {
  it('parses a valid scene payload', () => {
    const r = parseScene('{"scene":"人像","confidence":0.9}');
    expect(r).toEqual({ scene: '人像', confidence: 0.9 });
  });

  it('falls back to a known scene for an unknown label', () => {
    const r = parseScene('{"scene":"外星基地","confidence":0.5}');
    expect(['人像', '风景', '夜景', '美食', '逆光', '微距']).toContain(r.scene);
  });

  it('throws on malformed JSON', () => {
    expect(() => parseScene('not json')).toThrow();
  });

  it('treats a missing scene as the default', () => {
    const r = parseScene('{"confidence":0.5}');
    expect(['人像', '风景', '夜景', '美食', '逆光', '微距']).toContain(r.scene);
  });
});

describe('SCENE_SYSTEM_PROMPT', () => {
  it('instructs the model to return a scene label and confidence', () => {
    expect(SCENE_SYSTEM_PROMPT).toContain('scene');
    expect(SCENE_SYSTEM_PROMPT).toContain('confidence');
  });
});
