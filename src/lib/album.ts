export type AlbumItem = { uri: string; title: string; tag: string };

// Merges this session's captures with the device's real photos into one album.
// The unsaved shot from this session leads (it is the freshest and not yet in
// the library), then saved session shots, then device library photos newest
// first. Deduped by uri so a photo saved this session (already in the library)
// is not shown twice.
export function getAlbumImages(capturedUri: string | null, savedUris: string[], devicePhotos: AlbumItem[] = []): AlbumItem[] {
  const sessionUris = [...(capturedUri ? [capturedUri] : []), ...savedUris];
  const sessionItems: AlbumItem[] = [];
  for (const uri of new Set(sessionUris)) {
    sessionItems.push({
      uri,
      title: '我的作品',
      tag: savedUris.includes(uri) ? '已保存' : '本次拍摄 · 尚未保存',
    });
  }
  const sessionUriSet = new Set(sessionItems.map(item => item.uri));
  const deviceItems = devicePhotos.filter(item => !sessionUriSet.has(item.uri));
  return [...sessionItems, ...deviceItems];
}
