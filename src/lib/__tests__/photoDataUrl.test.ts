import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { toDataUrl } from '../photoDataUrl';

jest.mock('expo-file-system', () => ({
  readAsStringAsync: jest.fn(async () => 'FAKEBASE64'),
  EncodingType: { Base64: 'base64' },
}));

describe('toDataUrl', () => {
  beforeEach(() => {
    (FileSystem.readAsStringAsync as jest.Mock).mockClear();
    (FileSystem.readAsStringAsync as jest.Mock).mockImplementation(async () => 'FAKEBASE64');
  });

  it('returns an existing data URL unchanged', async () => {
    const dataUrl = 'data:image/jpeg;base64,QUJD';
    expect(await toDataUrl(dataUrl)).toBe(dataUrl);
    expect(FileSystem.readAsStringAsync).not.toHaveBeenCalled();
  });

  it('reads a native file uri and prefixes the jpeg data URL header', async () => {
    Platform.OS = 'android';
    const out = await toDataUrl('file:///cache/drama-filter-1.jpg');
    expect(FileSystem.readAsStringAsync).toHaveBeenCalledWith(
      'file:///cache/drama-filter-1.jpg',
      { encoding: 'base64' }
    );
    expect(out).toBe('data:image/jpeg;base64,FAKEBASE64');
  });

  it('propagates a read failure so the caller can fail open', async () => {
    Platform.OS = 'android';
    (FileSystem.readAsStringAsync as jest.Mock).mockImplementation(async () => {
      throw new Error('read failed');
    });
    await expect(toDataUrl('file:///cache/missing.jpg')).rejects.toThrow('read failed');
  });
});
