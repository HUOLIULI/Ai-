import { Platform } from 'react-native';
import { applyLutSpecToPhoto } from '../filters';
import { nativeFilterBackend } from '../nativeBackend';

const nativeApply = jest.fn(async () => 'native-uri');
let mockNative: { apply: (...args: unknown[]) => Promise<string> } | null = { apply: nativeApply };

jest.mock('expo-modules-core', () => ({
  requireOptionalNativeModule: () => mockNative,
}));

describe('lutFilter GPU branch integration', () => {
  beforeEach(() => {
    nativeApply.mockClear();
    nativeApply.mockImplementation(async () => 'native-uri');
    mockNative = { apply: nativeApply };
    Platform.OS = 'android';
  });

  it('routes an available gpu backend through the native module', async () => {
    const lut = { name: 'ai-grade', matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1], temperature: 5 };
    const out = await applyLutSpecToPhoto('input-uri', lut, nativeFilterBackend);
    expect(out).toBe('native-uri');
    expect(nativeApply).toHaveBeenCalledWith('input-uri', lut.matrix, [], 5, 0);
  });

  it('keeps the original uri when the gpu backend is unavailable', async () => {
    mockNative = null;
    const lut = { name: 'ai-grade', matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1] };
    const out = await applyLutSpecToPhoto('input-uri', lut, nativeFilterBackend);
    expect(out).toBe('input-uri');
    expect(nativeApply).not.toHaveBeenCalled();
  });

  it('fails open to the original uri when the native module throws', async () => {
    nativeApply.mockImplementation(async () => { throw new Error('decode failed'); });
    const lut = { name: 'ai-grade', matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1] };
    const out = await applyLutSpecToPhoto('input-uri', lut, nativeFilterBackend);
    expect(out).toBe('input-uri');
  });
});
