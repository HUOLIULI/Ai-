import { parseRelease } from '../appRelease';

const APK_DIGEST = 'a'.repeat(64);

function releasePayload(overrides: Record<string, unknown> = {}) {
  return {
    tag_name: 'v1.2.0',
    html_url: 'https://github.com/tommycyl/Drama/releases/tag/v1.2.0',
    name: 'Drama v1.2.0',
    body: 'notes',
    draft: false,
    prerelease: false,
    assets: [
      {
        id: 42,
        name: 'v1.2.0.apk',
        size: 24_000_000,
        browser_download_url: 'https://github.com/tommycyl/Drama/releases/download/v1.2.0/v1.2.0.apk',
        digest: `sha256:${APK_DIGEST}`,
      },
    ],
    ...overrides,
  };
}

describe('parseRelease sha256 extraction', () => {
  it('extracts the sha256 digest from the matching APK asset', () => {
    const release = parseRelease(releasePayload());
    expect(release.asset?.sha256).toBe(APK_DIGEST);
  });

  it('populates the real asset id, name, and size', () => {
    const release = parseRelease(releasePayload());
    expect(release.asset?.id).toBe(42);
    expect(release.asset?.name).toBe('v1.2.0.apk');
    expect(release.asset?.size).toBe(24_000_000);
  });

  it('keeps sha256 null when the asset has no digest', () => {
    const payload = releasePayload({
      assets: [{ id: 42, name: 'v1.2.0.apk', size: 1, browser_download_url: 'https://x/v1.2.0.apk' }],
    });
    const release = parseRelease(payload);
    expect(release.asset?.sha256).toBeNull();
  });

  it('keeps sha256 null when there are no assets', () => {
    const release = parseRelease(releasePayload({ assets: [] }));
    expect(release.asset?.sha256).toBeNull();
  });

  it('does not match a digest from a non-apk asset', () => {
    const payload = releasePayload({
      assets: [
        { id: 1, name: 'notes.txt', size: 1, browser_download_url: 'https://x/notes.txt', digest: `sha256:${'b'.repeat(64)}` },
        { id: 42, name: 'v1.2.0.apk', size: 24_000_000, browser_download_url: 'https://x/v1.2.0.apk', digest: `sha256:${APK_DIGEST}` },
      ],
    });
    const release = parseRelease(payload);
    expect(release.asset?.sha256).toBe(APK_DIGEST);
  });

  it('ignores a malformed digest and keeps sha256 null', () => {
    const payload = releasePayload({
      assets: [{ id: 42, name: 'v1.2.0.apk', size: 1, browser_download_url: 'https://x/v1.2.0.apk', digest: 'not-a-digest' }],
    });
    const release = parseRelease(payload);
    expect(release.asset?.sha256).toBeNull();
  });
});
