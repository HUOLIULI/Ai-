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
