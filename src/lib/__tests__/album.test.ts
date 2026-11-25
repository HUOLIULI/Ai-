import { getAlbumImages, type AlbumItem } from '../album';

function device(uri: string): AlbumItem {
  return { uri, title: `${uri}.jpg`, tag: '设备相册' };
}

describe('getAlbumImages', () => {
  it('returns an empty album when there are no session shots or device photos', () => {
    expect(getAlbumImages(null, [])).toEqual([]);
  });

  it('leads with the unsaved session capture tagged as not yet saved', () => {
    const images = getAlbumImages('file://shot.jpg', []);
    expect(images).toEqual([
      { uri: 'file://shot.jpg', title: '我的作品', tag: '本次拍摄 · 尚未保存' },
    ]);
  });

  it('tags a saved session shot as already saved', () => {
    const images = getAlbumImages(null, ['file://saved.jpg']);
    expect(images[0].tag).toBe('已保存');
  });

  it('places the unsaved capture before saved session shots', () => {
    const images = getAlbumImages('file://fresh.jpg', ['file://saved.jpg']);
    expect(images.map(item => item.uri)).toEqual(['file://fresh.jpg', 'file://saved.jpg']);
  });

  it('appends device photos after the session captures', () => {
    const images = getAlbumImages('file://shot.jpg', [], [device('ph://a'), device('ph://b')]);
    expect(images.map(item => item.uri)).toEqual(['file://shot.jpg', 'ph://a', 'ph://b']);
  });

  it('does not duplicate a device photo that is already a session capture', () => {
    const images = getAlbumImages(null, ['file://saved.jpg'], [device('file://saved.jpg'), device('ph://other')]);
    expect(images.map(item => item.uri)).toEqual(['file://saved.jpg', 'ph://other']);
    expect(images.filter(item => item.uri === 'file://saved.jpg')).toHaveLength(1);
  });

  it('keeps the newest device photo first when there is no session capture', () => {
    const images = getAlbumImages(null, [], [device('ph://newest'), device('ph://older')]);
    expect(images[0].uri).toBe('ph://newest');
  });
});
