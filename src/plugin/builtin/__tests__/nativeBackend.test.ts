import { Platform } from 'react-native';
import { nativeFilterBackend, applyLutToImageUri } from '../nativeBackend';
import { defaultFilterBackend } from '../defaultBackend';

const nativeApply = jest.fn(async () => 'native-uri');
let mockNative: { apply: (...args: unknown[]) => Promise<string> } | null = { apply: nativeApply };

jest.mock('expo-modules-core', () => ({
  requireOptionalNativeModule: () => mockNative,
}));

describe('nativeFilterBackend', () => {
  beforeEach(() => {
    nativeApply.mockClear();
    nativeApply.mockImplementation(async () => 'native-uri');
    mockNative = { apply: nativeApply };
  });

  it('is unavailable on web even when the module exists', () => {
    Platform.OS = 'web';
    expect(nativeFilterBackend.available()).toBe(false);
    Platform.OS = 'android';
  });

  it('is available on native when the module is present', () => {
    Platform.OS = 'android';
    expect(nativeFilterBackend.kind).toBe('gpu');
    expect(nativeFilterBackend.available()).toBe(true);
  });

  it('is unavailable when the native module is missing', () => {
    Platform.OS = 'android';
    mockNative = null;
    expect(nativeFilterBackend.available()).toBe(false);
  });

  it('flattens the curve and passes temperature/grain to the native module', async () => {
    Platform.OS = 'android';
    const out = await applyLutToImageUri('photo-uri', {
      name: 'warm',
      matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1],
      curve: [[0, 0], [0.5, 0.6], [1, 1]],
      temperature: 10,
      grain: 0.2,
    });
    expect(out).toBe('native-uri');
    expect(nativeApply).toHaveBeenCalledWith(
      'photo-uri',
      [1, 0, 0, 0, 1, 0, 0, 0, 1],
      [0, 0, 0.5, 0.6, 1, 1],
      10,
      0.2
    );
  });

  it('defaults missing temperature and grain to zero', async () => {
    Platform.OS = 'android';
    await applyLutToImageUri('photo-uri', { name: 'x', matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1] });
    expect(nativeApply).toHaveBeenCalledWith(
      'photo-uri',
      [1, 0, 0, 0, 1, 0, 0, 0, 1],
      [],
      0,
      0
    );
  });

  it('fails open to the original uri when the native call throws', async () => {
    Platform.OS = 'android';
    nativeApply.mockImplementation(async () => { throw new Error('boom'); });
    const out = await applyLutToImageUri('photo-uri', { name: 'x', matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1] });
    expect(out).toBe('photo-uri');
  });

  it('returns the original uri when the module is missing', async () => {
    Platform.OS = 'android';
    mockNative = null;
    const out = await applyLutToImageUri('photo-uri', { name: 'x', matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1] });
    expect(out).toBe('photo-uri');
  });
});

describe('defaultFilterBackend', () => {
  it('returns the native GPU backend on Android', () => {
    Platform.OS = 'android';
    expect(defaultFilterBackend().name).toBe('native-bitmap-lut');
  });

  it('returns the canvas backend on web', () => {
    Platform.OS = 'web';
    expect(defaultFilterBackend().name).toBe('web-canvas-lut');
    Platform.OS = 'android';
  });
});
