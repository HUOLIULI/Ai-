import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { PhotoReview } from '../PhotoReview';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));
jest.mock('../../../lib/photoQualityGuard', () => ({ analyzePhotoQuality: jest.fn(async () => ({ shouldRetake: false, hints: [] })) }));
jest.mock('../../../lib/nlEdit', () => ({
  editPhotoFromInstruction: jest.fn(async () => ({
    grade: { temperature: 0, exposure: 0, contrast: 0, saturation: 0, tint: 0 },
    look: { smoothing: 0, brightening: 0, warmth: 0 },
  })),
  applyNlEditToPhoto: jest.fn(async (_uri: string) => 'edited-uri'),
}));
jest.mock('../../../lib/aiConfig', () => ({ getActiveAIConfig: jest.fn(async () => ({ provider: 'dashscope', apiKey: 'k', baseUrl: 'https://x', model: 'm' })) }));
jest.mock('../../../lib/photoDataUrl', () => ({ toDataUrl: jest.fn(async (uri: string) => uri) }));
jest.mock('../../../lib/refColorMatch', () => ({
  analyzeReferenceGrade: jest.fn(async () => ({ temperature: 0.3, exposure: 0, contrast: 0.2, saturation: 0.4, tint: 0 })),
  applyReferenceGradeToPhoto: jest.fn(async (_uri: string) => 'matched-uri'),
}));
jest.mock('../../../lib/wbCorrection', () => ({
  analyzeWhiteBalance: jest.fn(async () => ({ cast: '偏暖', exposure: '过曝', severity: 0.6 })),
  applyWbCorrectionToPhoto: jest.fn(async (_uri: string) => 'corrected-uri'),
}));
jest.mock('../../../lib/media', () => ({
  loadDevicePhotos: jest.fn(async () => [
    { uri: 'ref-a', title: '参考A', tag: '设备相册' },
    { uri: 'ref-b', title: '参考B', tag: '设备相册' },
  ]),
}));

describe('PhotoReview natural-language edit', () => {
  it('renders the edit instruction input', () => {
    render(<PhotoReview uri="photo-uri" onRetake={() => {}} onSave={() => {}} saving={false} />);
    expect(screen.getByPlaceholderText('一句话修图，如：把天空调蓝一点')).toBeDefined();
  });

  it('hides the apply button until an instruction is entered', () => {
    render(<PhotoReview uri="photo-uri" onRetake={() => {}} onSave={() => {}} saving={false} />);
    expect(screen.queryByLabelText('应用修图')).toBeNull();
    fireEvent.changeText(screen.getByPlaceholderText('一句话修图，如：把天空调蓝一点'), '调亮一点');
    expect(screen.getByLabelText('应用修图')).toBeDefined();
  });
});

describe('PhotoReview reference color match', () => {
  it('loads reference thumbnails and applies a match to the selected reference', async () => {
    render(<PhotoReview uri="photo-uri" onRetake={() => {}} onSave={() => {}} saving={false} />);
    fireEvent.press(screen.getByLabelText('选择参考图'));
    const ref = await screen.findByLabelText('选用参考图 参考A');
    expect(screen.getByLabelText('选用参考图 参考B')).toBeDefined();
    fireEvent.press(ref);
    const apply = await screen.findByLabelText('应用参考图匹配');
    fireEvent.press(apply);
    expect(await screen.findByLabelText('应用参考图匹配')).toBeDefined();
  });

  it('keeps the photo unchanged when the match fails', async () => {
    const { applyReferenceGradeToPhoto } = require('../../../lib/refColorMatch');
    (applyReferenceGradeToPhoto as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    render(<PhotoReview uri="photo-uri" onRetake={() => {}} onSave={() => {}} saving={false} />);
    fireEvent.press(screen.getByLabelText('选择参考图'));
    const ref = await screen.findByLabelText('选用参考图 参考A');
    fireEvent.press(ref);
    fireEvent.press(await screen.findByLabelText('应用参考图匹配'));
    expect(await screen.findByText('匹配未生效，请检查 AI 配置或换张参考图。')).toBeDefined();
  });
});

describe('PhotoReview strength control', () => {
  it('renders the three strength presets with 足量 selected by default', () => {
    render(<PhotoReview uri="photo-uri" onRetake={() => {}} onSave={() => {}} saving={false} />);
    expect(screen.getByLabelText('增强强度轻')).toBeDefined();
    expect(screen.getByLabelText('增强强度适中')).toBeDefined();
    expect(screen.getByLabelText('增强强度足量')).toBeDefined();
    expect(screen.getByLabelText('增强强度足量').props.accessibilityState.selected).toBe(true);
  });

  it('lets the user select a lower strength', () => {
    render(<PhotoReview uri="photo-uri" onRetake={() => {}} onSave={() => {}} saving={false} />);
    fireEvent.press(screen.getByLabelText('增强强度轻'));
    expect(screen.getByLabelText('增强强度轻').props.accessibilityState.selected).toBe(true);
    expect(screen.getByLabelText('增强强度足量').props.accessibilityState.selected).toBe(false);
  });
});

describe('PhotoReview white-balance correction', () => {
  it('applies a corrective pass from the 自动校正白平衡 button', async () => {
    render(<PhotoReview uri="photo-uri" onRetake={() => {}} onSave={() => {}} saving={false} />);
    fireEvent.press(screen.getByLabelText('自动校正白平衡'));
    expect(await screen.findByLabelText('自动校正白平衡')).toBeDefined();
  });

  it('keeps the photo unchanged and shows a message when correction fails', async () => {
    const { applyWbCorrectionToPhoto } = require('../../../lib/wbCorrection');
    (applyWbCorrectionToPhoto as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    render(<PhotoReview uri="photo-uri" onRetake={() => {}} onSave={() => {}} saving={false} />);
    fireEvent.press(screen.getByLabelText('自动校正白平衡'));
    expect(await screen.findByText('校正未生效，请检查 AI 配置或稍后再试。')).toBeDefined();
  });
});
