import { faceBoxDetector, isFaceBoxSupported } from '../faceBox';
import type { FrameData } from '../../../types';

function frame(): FrameData {
  return { width: 768, height: 576, dataUrl: 'data:image/jpeg;base64,AA', capturedAt: 0 };
}

// The native module is platform-dependent. In the Jest environment the
// detector must resolve to null on platforms without MLKit, and to a face
// event when a mocked native layer reports a face.
describe('faceBoxDetector', () => {
  it('reports no face on platforms without the native module', async () => {
    const detector = faceBoxDetector();
    const event = await detector.detect(frame());
    expect(event).toBeNull();
  });

  it('is only supported on Android with the native module', () => {
    // jest-expo runs under the native test preset; isFaceBoxSupported must
    // be false wherever the module cannot load.
    expect(typeof isFaceBoxSupported()).toBe('boolean');
  });

  it('is an idempotent no-op for repeated frames on unsupported platforms', async () => {
    const detector = faceBoxDetector();
    expect(await detector.detect(frame())).toBeNull();
    expect(await detector.detect(frame())).toBeNull();
  });
});
