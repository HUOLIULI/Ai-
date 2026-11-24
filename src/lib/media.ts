import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import type { AlbumItem } from './album';

export async function saveImageToLibrary(uri: string) {
  // Web camera captures are data URLs and can be retained in the app's store.
  if (Platform.OS === 'web') return { saved: true as const, uri };
  const permission = await MediaLibrary.requestPermissionsAsync();
  if (!permission.granted) return { saved: false as const, reason: 'permission' as const };
  if (!FileSystem.documentDirectory) throw new Error('照片存储目录不可用');
  const directory = `${FileSystem.documentDirectory}captures/`;
  // Re-saving a photo already retained by this app must not create duplicates.
  if (uri.startsWith(directory)) return { saved: true as const, uri };
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const savedUri = `${directory}${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  await FileSystem.copyAsync({ from: uri, to: savedUri });
  try {
    await MediaLibrary.createAssetAsync(savedUri);
  } catch (error) {
    await FileSystem.deleteAsync(savedUri, { idempotent: true }).catch(() => undefined);
    throw error;
  }
  return { saved: true as const, uri: savedUri };
}

// How many recent device photos the album loads up front. The album paginates
// nothing for now; 60 keeps the first paint light while still reading as a real
// gallery. Newest first.
const DEVICE_PHOTO_LIMIT = 60;

// Loads the device's real photos so the album shows the whole library, not just
// this session's shots. Read permission is requested on first use; a denial or
// any error fails open to an empty list so the album still renders the session
// captures. Web has no device library and returns [].
export async function loadDevicePhotos(): Promise<AlbumItem[]> {
  if (Platform.OS === 'web') return [];
  try {
    const permission = await MediaLibrary.requestPermissionsAsync();
    if (!permission.granted) return [];
    const page = await MediaLibrary.getAssetsAsync({
      first: DEVICE_PHOTO_LIMIT,
      mediaType: MediaLibrary.MediaType.photo,
      sortBy: MediaLibrary.SortBy.creationTime,
    });
    return page.assets.map(asset => ({
      uri: asset.uri,
      title: asset.filename || '相册照片',
      tag: '设备相册',
    }));
  } catch {
    return [];
  }
}
