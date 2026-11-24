import { Platform } from 'react-native';
import { canvasFilterBackend, applyLutToImageUri } from '../canvasBackend';
import { LUTS } from '../lut';

describe('canvasFilterBackend', () => {
  it('is a js backend named web-canvas-lut', () => {
    expect(canvasFilterBackend.kind).toBe('js');
    expect(canvasFilterBackend.name).toBe('web-canvas-lut');
  });

  it('is available only on web with a DOM', () => {
    expect(canvasFilterBackend.available()).toBe(Platform.OS === 'web' && typeof document !== 'undefined');
  });
});

describe('applyLutToImageUri', () => {
  it('fails open: returns the original uri when the image cannot load', async () => {
    // A non-image src will not decode; the backend must return the original.
    const result = await applyLutToImageUri('not-a-real-image', LUTS['清透']);
    expect(result).toBe('not-a-real-image');
  });
});
