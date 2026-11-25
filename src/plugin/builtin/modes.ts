import type { ModePlugin } from '../types';
import { CAMERA_MODE_PROMPTS } from '../../constants/photographyPrompts';
import type { CameraMode } from '../../types/guidance';

// Built-in photography mode plugins. The prompt text is the single source of
// truth moved out of constants; third-party plugins can register more modes
// without touching this file.
export const MODE_PLUGINS: ModePlugin[] = (Object.keys(CAMERA_MODE_PROMPTS) as CameraMode[])
  .map(id => ({
    id,
    label: id,
    prompt: CAMERA_MODE_PROMPTS[id],
  }));
