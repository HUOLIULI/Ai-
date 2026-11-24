import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';

// Converts a photo uri into the base64 data URL the vision model needs.
// Web already holds a canvas data URL, returned unchanged. On native the
// filtered photo is a file:// uri in the app cache, so read it back as base64
// and prefix the JPEG header. Throws on a failed read so the caller can fail
// open (keep the original photo) rather than sending the model a non-image.
export async function toDataUrl(uri: string): Promise<string> {
  if (uri.startsWith('data:')) return uri;
  if (Platform.OS === 'web') return uri;
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return `data:image/jpeg;base64,${base64}`;
}
