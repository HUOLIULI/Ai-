import { sceneChangeDetector } from '../sceneChange';
import { lightingDetector, analyzeFrame } from '../lighting';
import type { FrameData } from '../../../types';

function frame(dataUrl: string, capturedAt = 0): FrameData {
  return { width: 768, height: 576, dataUrl, capturedAt };
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return `data:image/jpeg;base64,${btoa(binary)}`;
}

describe('sceneChangeDetector', () => {
  it('returns null when there is no previous frame', async () => {
    const detector = sceneChangeDetector(null);
    await expect(detector.detect(frame('data:image/jpeg;base64,AAAA'))).resolves.toBeNull();
  });

  it('returns null when the frame header is unchanged', async () => {
    const prev = frame(bytesToBase64(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])));
    const next = frame(bytesToBase64(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])));
    const detector = sceneChangeDetector(prev);
    await expect(detector.detect(next)).resolves.toBeNull();
  });

  it('reports a scene change when the header differs significantly', async () => {
    const prev = frame(bytesToBase64(new Uint8Array([1, 1, 1, 1, 1, 1, 1, 1])));
    const next = frame(bytesToBase64(new Uint8Array([255, 0, 255, 0, 255, 0, 255, 0])));
    const detector = sceneChangeDetector(prev);
    const event = await detector.detect(next);
    expect(event?.type).toBe('sceneChange');
  });

  it('does not report a change when frames are far apart in time only', async () => {
    const prev = frame(bytesToBase64(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])), 0);
    const next = frame(bytesToBase64(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])), 10_000);
    const detector = sceneChangeDetector(prev);
    await expect(detector.detect(next)).resolves.toBeNull();
  });
});

describe('analyzeFrame', () => {
  it('computes mean brightness and highlight ratio over luminance bytes', () => {
    const bytes = new Uint8Array([0, 100, 200, 255]);
    const stats = analyzeFrame(bytes);
    expect(stats.mean).toBeCloseTo(138.75, 5);
    expect(stats.highlights).toBeCloseTo(0.25, 5);
  });

  it('treats an empty frame as dark', () => {
    const stats = analyzeFrame(new Uint8Array(0));
    expect(stats.mean).toBe(0);
    expect(stats.highlights).toBe(0);
  });
});

describe('lightingDetector', () => {
  it('flags a dark frame', async () => {
    const detector = lightingDetector();
    const dataUrl = bytesToBase64(new Uint8Array(64).fill(10));
    const event = await detector.detect(frame(dataUrl));
    expect(event?.type).toBe('lighting');
    expect((event?.data as { mean: number }).mean).toBeLessThan(40);
  });

  it('flags a frame with blown highlights', async () => {
    const detector = lightingDetector();
    const dataUrl = bytesToBase64(new Uint8Array(64).fill(255));
    const event = await detector.detect(frame(dataUrl));
    expect(event?.type).toBe('lighting');
    expect((event?.data as { highlights: number }).highlights).toBeGreaterThan(0.15);
  });

  it('returns null for a well-exposed frame', async () => {
    const detector = lightingDetector();
    const dataUrl = bytesToBase64(new Uint8Array(64).fill(128));
    await expect(detector.detect(frame(dataUrl))).resolves.toBeNull();
  });
});
