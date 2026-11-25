// Built-in LUT specifications for the four shipping styles.
//
// Matrix values follow the public conventions of Canon Picture Styles and
// widely circulated Fujifilm film recipes (see docs/photography-prompts.md).
// Each LUT is applied as: out = matrix * in, then curve, then temperature
// shift, then optional grain. The JS filter backend approximates the curve
// with expo-image-manipulator adjustments; a future GPU backend can use the
// same spec as a lookup table.

import type { LutSpec } from '../types';

export const LUTS: Record<string, LutSpec> = {
  // Fresh / clear: near-identity matrix, lifted shadows, slightly cooler.
  清透: {
    name: '清透',
    matrix: [1.02, 0, 0, 0, 1.01, 0, 0, 0, 0.99],
    curve: [[0, 0.03], [0.5, 0.55], [1, 1]],
    temperature: -150,
    grain: 0,
  },
  // Warm apricot: warm cast, soft contrast, gentle tone.
  奶杏: {
    name: '奶杏',
    matrix: [1.06, 0, 0, 0, 1.03, 0, 0, 0, 0.96],
    curve: [[0, 0.02], [0.5, 0.5], [1, 0.99]],
    temperature: 250,
    grain: 0.05,
  },
  // Fresh mint: green lift, cooler, brighter highlights.
  薄荷: {
    name: '薄荷',
    matrix: [0.97, 0, 0, 0, 1.04, 0, 0, 0, 1.02],
    curve: [[0, 0.04], [0.5, 0.56], [1, 1]],
    temperature: -80,
    grain: 0,
  },
  // Vintage film: warm cast, S-curve contrast, slight grain.
  胶片: {
    name: '胶片',
    matrix: [1.04, 0, 0, 0, 1.01, 0, 0, 0, 0.95],
    curve: [[0, 0.05], [0.25, 0.22], [0.75, 0.78], [1, 0.95]],
    temperature: 120,
    grain: 0.15,
  },
  // Monochrome: desaturate to luma, punchy contrast curve.
  黑白: {
    name: '黑白',
    matrix: [0.3, 0.59, 0.11, 0.3, 0.59, 0.11, 0.3, 0.59, 0.11],
    curve: [[0, 0], [0.25, 0.18], [0.75, 0.82], [1, 1]],
    temperature: 0,
    grain: 0.1,
  },
  // Hong Kong cinematic: teal shadows, warm highlights, teal-orange split.
  港风: {
    name: '港风',
    matrix: [1.08, 0, -0.04, 0, 0.98, 0.02, -0.02, 0.02, 1.04],
    curve: [[0, 0.04], [0.3, 0.26], [0.7, 0.74], [1, 0.96]],
    temperature: -60,
    grain: 0.08,
  },
  // Japanese pastel: airy lift, low contrast, soft pink cast.
  日系: {
    name: '日系',
    matrix: [1.03, 0.01, 0, 0, 1.0, 0, 0.01, 0, 1.02],
    curve: [[0, 0.1], [0.5, 0.58], [1, 0.98]],
    temperature: 60,
    grain: 0,
  },
  // Faded retro: lifted blacks, muted saturation, warm old-film cast.
  复古: {
    name: '复古',
    matrix: [1.0, 0, 0, 0, 0.97, 0, 0, 0, 0.9],
    curve: [[0, 0.12], [0.5, 0.52], [1, 0.9]],
    temperature: 180,
    grain: 0.12,
  },
};
