import type { LutSpec } from '../plugin/types';

// Film texture customization: overlays user-tunable grain and vignette onto a
// chosen style LUT, turning the fixed style set into a style × texture space.
// Pure: returns a new LutSpec with the texture fields overridden and never
// mutates the input, so the base style preset stays pristine.

export type FilmTexture = { grain: number; vignette: number };

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

// Returns a new LutSpec with grain and vignette overridden by the given
// texture amounts (each clamped to 0..1). The input LUT is not mutated.
export function withFilmTexture(lut: LutSpec, texture: FilmTexture): LutSpec {
  return {
    ...lut,
    grain: clamp01(texture.grain),
    vignette: clamp01(texture.vignette),
  };
}
