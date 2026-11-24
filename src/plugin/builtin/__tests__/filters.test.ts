import { LUTS } from '../lut';
import { applyLutToImageData, jsFilterBackend, styleFilter } from '../filters';
import type { CameraStyle } from '../../../types/guidance';

function fakeImageData(width: number, height: number, fill = 128): ImageData {
  return {
    width, height,
    data: new Uint8ClampedArray(width * height * 4).fill(fill),
  } as unknown as ImageData;
}

describe('LUTS', () => {
  it('ships four style LUTs with valid matrices', () => {
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
