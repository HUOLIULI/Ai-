import type { StylePlugin } from '../types';
import { CAMERA_STYLE_PRESETS } from '../../constants/guidance';
import { LUTS } from './lut';

// Built-in style plugins: the four shipping styles, each bound to a hardware
// preset (white balance + contrast) and a LUT spec for post-processing.
// The prompt text that reaches the vision model stays in constants; the LUT
// is what makes the style visible in the saved photo.
export const STYLE_PLUGINS: StylePlugin[] = (Object.keys(CAMERA_STYLE_PRESETS) as (keyof typeof CAMERA_STYLE_PRESETS)[]).map(id => ({
  id,
  label: id,
  description: `${id}风格成片调色`,
  preset: CAMERA_STYLE_PRESETS[id],
  lut: LUTS[id],
}));
