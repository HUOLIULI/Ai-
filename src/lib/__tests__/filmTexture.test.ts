import { vignetteFactor, applyLutToImageData } from '../../plugin/builtin/lutMath';
import { withFilmTexture } from '../filmTexture';
import type { LutSpec } from '../../plugin/types';

function fakeImageData(width: number, height: number, fill = 128): ImageData {
  return {
    width, height,
    data: new Uint8ClampedArray(width * height * 4).fill(fill),
  } as unknown as ImageData;
}

const baseLut: LutSpec = {
  name: '测试', matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1], temperature: 0,
};

describe('vignetteFactor', () => {
  it('is 1 (no darkening) at the center', () => {
    expect(vignetteFactor(0, 0, 0.8)).toBe(1);
  });

  it('darkens most at the corners', () => {
    const center = vignetteFactor(0, 0, 0.8);
    const corner = vignetteFactor(1, 1, 0.8);
    expect(corner).toBeLessThan(center);
  });

  it('is a true no-op when amount is 0 or negative', () => {
    expect(vignetteFactor(1, 1, 0)).toBe(1);
    expect(vignetteFactor(1, 1, -0.5)).toBe(1);
  });

  it('scales monotonically with amount at a fixed position', () => {
    const weak = vignetteFactor(1, 1, 0.3);
    const strong = vignetteFactor(1, 1, 0.9);
    expect(strong).toBeLessThan(weak);
  });
});

describe('applyLutToImageData vignette', () => {
  it('darkens corner pixels more than the center', () => {
    const lut: LutSpec = { ...baseLut, vignette: 0.8 };
    // 5x5 frame, all mid-gray; corners should end darker than the center pixel.
    const frame = fakeImageData(5, 5, 200);
    const out = applyLutToImageData(frame, lut);
    const at = (x: number, y: number) => out.data[(y * 5 + x) * 4];
    expect(at(2, 2)).toBeGreaterThan(at(0, 0)); // center brighter than corner
  });

  it('preserves hue by scaling RGB equally at a corner', () => {
    const lut: LutSpec = { ...baseLut, vignette: 0.8 };
    const frame = fakeImageData(3, 3, 0);
    frame.data[0] = 200; frame.data[1] = 100; frame.data[2] = 50; frame.data[3] = 255; // top-left pixel
    const out = applyLutToImageData(frame, lut);
    // All channels scaled by the same factor -> the R>G>B ordering is kept.
    expect(out.data[0]).toBeGreaterThan(out.data[1]);
    expect(out.data[1]).toBeGreaterThan(out.data[2]);
  });

  it('is a no-op when vignette is 0 or absent', () => {
    const frame = fakeImageData(4, 4, 150);
    const noVignette = applyLutToImageData(frame, { ...baseLut, vignette: 0 });
    const absent = applyLutToImageData(frame, baseLut);
    expect(noVignette.data[0]).toBe(150);
    expect(absent.data[0]).toBe(150);
  });
});

describe('withFilmTexture', () => {
  it('overrides grain and vignette without mutating the input', () => {
    const original: LutSpec = { ...baseLut, grain: 0.1, vignette: 0.2 };
    const out = withFilmTexture(original, { grain: 0.7, vignette: 0.6 });
    expect(out.grain).toBe(0.7);
    expect(out.vignette).toBe(0.6);
    expect(original.grain).toBe(0.1); // input untouched
    expect(original.vignette).toBe(0.2);
  });

  it('clamps texture amounts into 0-1', () => {
    const out = withFilmTexture(baseLut, { grain: 1.5, vignette: -0.3 });
    expect(out.grain).toBe(1);
    expect(out.vignette).toBe(0);
  });

  it('preserves the other LUT fields', () => {
    const lut: LutSpec = { ...baseLut, matrix: [1.1, 0, 0, 0, 1, 0, 0, 0, 0.9], temperature: 120 };
    const out = withFilmTexture(lut, { grain: 0.5, vignette: 0.5 });
    expect(out.matrix).toEqual(lut.matrix);
    expect(out.temperature).toBe(120);
    expect(out.name).toBe(lut.name);
  });
});
