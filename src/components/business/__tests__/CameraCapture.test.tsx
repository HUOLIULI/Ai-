import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { CameraCapture } from '../CameraCapture';
import type { CameraView } from 'expo-camera';

jest.mock('expo-camera', () => ({ __esModule: true, CameraView: 'CameraView' }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-linear-gradient', () => ({
  __esModule: true, LinearGradient: 'LinearGradient',
}));
jest.mock('expo-status-bar', () => ({ __esModule: true, StatusBar: 'StatusBar' }));
jest.mock('react-native-safe-area-context', () => ({
  __esModule: true, SafeAreaView: 'SafeAreaView',
}));
jest.mock('../CameraGuidanceControls', () => ({
  __esModule: true, CameraGuidanceControls: 'CameraGuidanceControls',
}));
jest.mock('../CameraParameterPanel', () => ({
  __esModule: true, CameraParameterPanel: 'CameraParameterPanel',
}));
jest.mock('../CameraDirectionOverlay', () => ({
  __esModule: true, CameraDirectionOverlay: 'CameraDirectionOverlay',
}));
jest.mock('../CameraReadyEffects', () => ({
  __esModule: true, CameraReadyFrame: 'CameraReadyFrame', CameraShutterHalo: 'CameraShutterHalo',
}));
jest.mock('../PoseGuideOverlay', () => ({
  __esModule: true, PoseGuideOverlay: 'PoseGuideOverlay',
}));
jest.mock('../../../hooks/useCameraGuidance', () => ({
  useCameraGuidance: () => ({
    context: { style: '清透', mode: '人像', facing: 'back', zoom: 0, flash: 'off' },
    enabled: true, autoZoom: true, adjustingZoom: false, adjustingParameters: false,
    ready: true, active: true, capturing: false, sampling: false, switching: false,
    starting: false, result: null, target: null, executionPhase: null, status: 'idle',
    configMissing: false, sensorAvailable: true, tuningMessage: null, appliedTuning: null,
    sampleFrame: jest.fn(), toggleGuidance: jest.fn(), toggleAutoZoom: jest.fn(),
    manualZoom: jest.fn(), adjustParameters: jest.fn(), changeStyle: jest.fn(),
    changeMode: jest.fn(), flipCamera: jest.fn(), cameraReady: jest.fn(),
    cameraError: jest.fn(), capture: jest.fn(), confirmAdjustment: jest.fn(),
    refresh: jest.fn(),
  }),
}));
jest.mock('../../../store/captureStore', () => ({
  useCaptureStore: () => ({ savedUris: [] }),
}));
jest.mock('../../../hooks/usePoseGuidance', () => ({
  usePoseGuidance: () => ({
    enabled: false, starting: false, phase: null, message: '', recommendation: null,
    index: 0, current: null, configMissing: false, toggle: jest.fn(),
    refresh: jest.fn(), next: jest.fn(),
  }),
}));

describe('CameraCapture', () => {
  it('renders the capture deck and guidance controls', () => {
    const cameraRef = { current: null } as React.RefObject<CameraView>;
    render(
      <CameraCapture
        cameraRef={cameraRef}
        onClose={() => {}}
        onCapture={() => {}}
        onConfigure={() => {}}
      />,
    );
    expect(screen.getByLabelText('拍照')).toBeDefined();
    expect(screen.getByLabelText('关闭相机')).toBeDefined();
  });
});
