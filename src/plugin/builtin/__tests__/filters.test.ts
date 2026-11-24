import { LUTS } from '../lut';
import { applyLutToImageData, applyLutSpecToPhoto, jsFilterBackend, styleFilter } from '../filters';
import type { CameraStyle } from '../../../types/guidance';

function fakeImageData(width: number, height: number, fill = 128): ImageData {
  return {
    width, height,
    data: new Uint8ClampedArray(width * height * 4).fill(fill),
  } as unknown as ImageData;
}

describe('LUTS', () => {
  it('ships the four original style LUTs with valid near-identity matrices', () => {
    for (const style of ['清透', '奶杏', '薄荷', '胶片'] as CameraStyle[]) {
      const lut = LUTS[style];
      expect(lut).toBeDefined();
      expect(lut.matrix).toHaveLength(9);
      // Matrices are near-identity: diagonal dominates.
      for (let i = 0; i < 3; i++) {
        expect(lut.matrix[i * 3 + i]).toBeGreaterThan(0.8);
      }
    }
  });

  it('film LUT has an S-curve (more than 2 control points)', () => {
    expect(LUTS['胶片'].curve?.length).toBeGreaterThan(2);
  });
});

describe('film style LUTs', () => {
  it('ships every declared camera style as a LUT', () => {
    for (const style of ['清透', '奶杏', '薄荷', '胶片', '黑白', '港风', '日系', '复古'] as CameraStyle[]) {
      expect(LUTS[style]).toBeDefined();
      expect(LUTS[style].matrix).toHaveLength(9);
    }
  });

  it('monochrome desaturates a colored frame to equal channels', () => {
    const frame = fakeImageData(1, 1, 128);
    // Make the pixel colored so desaturation is observable.
    frame.data[0] = 200; frame.data[1] = 100; frame.data[2] = 50; frame.data[3] = 255;
    const out = applyLutToImageData(frame, LUTS['黑白']);
    expect(out.data[0]).toBe(out.data[1]);
    expect(out.data[1]).toBe(out.data[2]);
  });

  it('Japanese pastel lifts the black point for an airy low-contrast look', () => {
    const frame = fakeImageData(1, 1, 0);
    const out = applyLutToImageData(frame, LUTS['日系']);
    // The curve lifts pure black well above zero.
    expect(out.data[0]).toBeGreaterThan(10);
  });

  it('faded retro lifts blacks and mutes highlights versus pure black/white', () => {
    const black = applyLutToImageData(fakeImageData(1, 1, 0), LUTS['复古']);
    const white = applyLutToImageData(fakeImageData(1, 1, 255), LUTS['复古']);
    expect(black.data[0]).toBeGreaterThan(10); // lifted blacks
    expect(white.data[0]).toBeLessThan(255); // muted highlights
  });
});

describe('applyLutToImageData', () => {
  it('applies a warm matrix to a neutral frame', () => {
    const frame = fakeImageData(2, 2, 128);
    const out = applyLutToImageData(frame, LUTS['奶杏']);
    // Warm LUT lifts red, lowers blue.
    expect(out.data[0]).toBeGreaterThan(out.data[2]);
  });

  it('is a no-op for an identity matrix', () => {
    const frame = fakeImageData(1, 1, 100);
    const identity = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    const out = applyLutToImageData(frame, { name: 'id', matrix: identity });
    expect(out.data[0]).toBe(100);
    expect(out.data[1]).toBe(100);
    expect(out.data[2]).toBe(100);
    expect(out.data[3]).toBe(100);
  });

  it('clamps outputs to the 0-255 range', () => {
    const frame = fakeImageData(1, 1, 255);
    // Boost matrix pushes red over range.
    const out = applyLutToImageData(frame, { name: 'boost', matrix: [5, 0, 0, 0, 5, 0, 0, 0, 5] });
    expect(out.data[0]).toBe(255);
  });
});

describe('jsFilterBackend / styleFilter', () => {
  it('exposes a JS backend that is always available', () => {
    expect(jsFilterBackend.kind).toBe('js');
    expect(jsFilterBackend.available()).toBe(true);
  });

  it('returns a filter plugin that resolves to an output uri', async () => {
    const filter = styleFilter('清透');
    // In unit tests, the backend resolves synchronously to a sentinel uri.
    const result = await filter.apply(jsFilterBackend, 'input-uri');
    expect(typeof result).toBe('string');
  });
});

describe('applyLutSpecToPhoto', () => {
  it('applies an arbitrary LutSpec and returns a uri', async () => {
    const lut = { name: 'ai-grade', matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1] };
    const result = await applyLutSpecToPhoto('input-uri', lut, jsFilterBackend);
    expect(typeof result).toBe('string');
  });

  it('is a no-op returning the original uri when the backend is unavailable', async () => {
    const unavailable = { kind: 'gpu' as const, name: 'none', available: () => false };
    const lut = { name: 'ai-grade', matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1] };
    await expect(applyLutSpecToPhoto('input-uri', lut, unavailable)).resolves.toBe('input-uri');
  });
});
