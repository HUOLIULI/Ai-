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
jest.mock('../../../lib/sceneAdvice', () => ({
  getSceneAdvice: jest.fn(async () => ({
    scene: '逆光', mode: '风景', style: '清透', exposureHint: '压低曝光', rationale: '检测到逆光，建议清透风格。', confidence: 0.9,
  })),
  applySceneAdviceToPhoto: jest.fn(async (_uri: string) => 'advised-uri'),
}));
jest.mock('../../../lib/autoEnhance', () => ({
  planAutoEnhance: jest.fn(async () => ({
    advice: { scene: '逆光', mode: '风景', style: '清透', exposureHint: '', rationale: '', confidence: 0.9 },
    wb: { cast: '偏暖', exposure: '过曝', severity: 0.6 },
  })),
  applyAutoEnhanceToPhoto: jest.fn(async (_uri: string) => 'enhanced-uri'),
}));
jest.mock('../../../lib/media', () => ({
  loadDevicePhotos: jest.fn(async () => [
    { uri: 'ref-a', title: '参考A', tag: '设备相册' },
    { uri: 'ref-b', title: '参考B', tag: '设备相册' },
  ]),
}));
jest.mock('../../../plugin/builtin/filters', () => ({
  applyLutSpecToPhoto: jest.fn(async (_uri: string) => `textured-${_uri}`),
}));
jest.mock('../../../plugin/builtin', () => ({
  defaultFilterBackend: jest.fn(() => ({})),
}));
jest.mock('../../../lib/photoCompositions', () => ({
  suggestCompositions: jest.fn(async () => [
    { label: '三分法', box: { centerX: 0.4, centerY: 0.45, width: 0.8, height: 0.8 }, rationale: '主体落在左三分线上。' },
    { label: '特写', box: { centerX: 0.5, centerY: 0.5, width: 0.5, height: 0.5 }, rationale: '收紧到主体，更聚焦。' },
  ]),
}));
jest.mock('../../../lib/photoCrop', () => ({
  suggestCrop: jest.fn(async () => ({ box: { centerX: 0.5, centerY: 0.5, width: 0.8, height: 0.8 }, rationale: '收紧到主体。' })),
  getImageSize: jest.fn(async () => ({ width: 1000, height: 1000 })),
  cropBoxToRect: jest.fn((box: { centerX: number; centerY: number; width: number; height: number }, w: number, h: number) => ({
    originX: Math.round((box.centerX - box.width / 2) * w),
    originY: Math.round((box.centerY - box.height / 2) * h),
    width: Math.round(box.width * w),
    height: Math.round(box.height * h),
  })),
  applyCropToPhoto: jest.fn(async (_uri: string) => `cropped-${_uri}`),
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

describe('PhotoReview scene advice', () => {
  it('loads a scene suggestion and applies the recommended style', async () => {
    render(<PhotoReview uri="photo-uri" onRetake={() => {}} onSave={() => {}} saving={false} />);
    fireEvent.press(screen.getByLabelText('获取场景建议'));
    const apply = await screen.findByLabelText('应用场景建议');
    expect(await screen.findByText('检测到逆光，建议清透风格。')).toBeDefined();
    fireEvent.press(apply);
    expect(await screen.findByLabelText('应用场景建议')).toBeDefined();
  });

  it('shows a message when scene recognition fails', async () => {
    const { getSceneAdvice } = require('../../../lib/sceneAdvice');
    (getSceneAdvice as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    render(<PhotoReview uri="photo-uri" onRetake={() => {}} onSave={() => {}} saving={false} />);
    fireEvent.press(screen.getByLabelText('获取场景建议'));
    expect(await screen.findByText('未能识别场景，请检查 AI 配置或稍后再试。')).toBeDefined();
  });
});

describe('PhotoReview one-tap auto-enhance', () => {
  it('renders the flagship auto-enhance button and applies a plan', async () => {
    render(<PhotoReview uri="photo-uri" onRetake={() => {}} onSave={() => {}} saving={false} />);
    fireEvent.press(screen.getByLabelText('一键智能增强'));
    expect(await screen.findByLabelText('一键智能增强')).toBeDefined();
  });

  it('keeps the photo unchanged and shows a message when auto-enhance fails', async () => {
    const { applyAutoEnhanceToPhoto } = require('../../../lib/autoEnhance');
    (applyAutoEnhanceToPhoto as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    render(<PhotoReview uri="photo-uri" onRetake={() => {}} onSave={() => {}} saving={false} />);
    fireEvent.press(screen.getByLabelText('一键智能增强'));
    expect(await screen.findByText('增强未生效，请检查 AI 配置或稍后再试。')).toBeDefined();
  });
});

describe('PhotoReview film texture', () => {
  it('renders grain/vignette level controls', () => {
    render(<PhotoReview uri="photo-uri" onRetake={() => {}} onSave={() => {}} saving={false} />);
    expect(screen.getByLabelText('颗粒无')).toBeDefined();
    expect(screen.getByLabelText('颗粒重')).toBeDefined();
    expect(screen.getByLabelText('暗角无')).toBeDefined();
    expect(screen.getByLabelText('暗角重')).toBeDefined();
    expect(screen.getByLabelText('颗粒无').props.accessibilityState.selected).toBe(true);
    expect(screen.getByLabelText('暗角无').props.accessibilityState.selected).toBe(true);
  });

  it('layers texture on the edited photo instead of the original, without compounding', async () => {
    const { applyLutSpecToPhoto } = require('../../../plugin/builtin/filters');
    render(<PhotoReview uri="photo-uri" onRetake={() => {}} onSave={() => {}} saving={false} />);
    // First apply a non-texture edit so there is a graded base to protect.
    fireEvent.press(screen.getByLabelText('获取场景建议'));
    fireEvent.press(await screen.findByLabelText('应用场景建议'));
    await screen.findByLabelText('应用场景建议');
    // Now add grain: texture must read the edited base, not the original uri.
    (applyLutSpecToPhoto as jest.Mock).mockClear();
    fireEvent.press(screen.getByLabelText('颗粒中'));
    await screen.findByLabelText('颗粒中');
    const firstCall = (applyLutSpecToPhoto as jest.Mock).mock.calls[0][0];
    expect(firstCall).toBe('advised-uri');
    // Moving the vignette slider re-renders from the same texture base, so the
    // two passes do not stack grain/vignette on top of each other.
    (applyLutSpecToPhoto as jest.Mock).mockClear();
    fireEvent.press(screen.getByLabelText('暗角中'));
    await screen.findByLabelText('暗角中');
    const secondCall = (applyLutSpecToPhoto as jest.Mock).mock.calls[0][0];
    expect(secondCall).toBe('advised-uri');
  });
});

describe('PhotoReview multi-composition', () => {
  it('renders the multi-composition entry button', () => {
    render(<PhotoReview uri="photo-uri" onRetake={() => {}} onSave={() => {}} saving={false} />);
    expect(screen.getByLabelText('AI 多构图')).toBeDefined();
  });

  it('loads composition variants and applies the selected one as a crop', async () => {
    const { applyCropToPhoto } = require('../../../lib/photoCrop');
    render(<PhotoReview uri="photo-uri" onRetake={() => {}} onSave={() => {}} saving={false} />);
    fireEvent.press(screen.getByLabelText('AI 多构图'));
    // Both variants load as selectable chips.
    expect(await screen.findByLabelText('构图方案三分法')).toBeDefined();
    expect(screen.getByLabelText('构图方案特写')).toBeDefined();
    expect(screen.getByText('主体落在左三分线上。')).toBeDefined();
    // A crop-box overlay previews the selected variant on the photo.
    expect(screen.getByTestId('composition-crop-box')).toBeDefined();
    // Selecting the second variant updates the shown rationale.
    fireEvent.press(screen.getByLabelText('构图方案特写'));
    expect(await screen.findByText('收紧到主体，更聚焦。')).toBeDefined();
    // Applying crops the preview to the selected framing.
    fireEvent.press(screen.getByLabelText('应用此构图'));
    expect(await screen.findByLabelText('AI 多构图')).toBeDefined();
    expect(applyCropToPhoto).toHaveBeenCalled();
    expect(screen.queryByTestId('composition-crop-box')).toBeNull();
  });

  it('keeps the photo unchanged and shows a message when composition fails', async () => {
    const { suggestCompositions } = require('../../../lib/photoCompositions');
    (suggestCompositions as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    render(<PhotoReview uri="photo-uri" onRetake={() => {}} onSave={() => {}} saving={false} />);
    fireEvent.press(screen.getByLabelText('AI 多构图'));
    expect(await screen.findByText('未能生成构图方案，请检查 AI 配置或稍后再试。')).toBeDefined();
  });
});
