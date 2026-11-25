import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { CameraGuidanceControls } from '../CameraGuidanceControls';
import type { GuidanceStatus } from '../../../types/guidance';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

const status: GuidanceStatus = { phase: 'off', message: '' };

function renderControls(overrides: Partial<Parameters<typeof CameraGuidanceControls>[0]> = {}) {
  const props = {
    enabled: true, starting: false, disabled: false, autoZoom: true,
    status, configMissing: false,
    onToggle: jest.fn(), onAutoZoom: jest.fn(), onRefresh: jest.fn(), onConfigure: jest.fn(),
    ...overrides,
  };
  render(<CameraGuidanceControls {...props} />);
  return props;
}

describe('CameraGuidanceControls color grade toggle', () => {
  it('shows the AI color grade toggle when the handler is provided', () => {
    renderControls({ autoColorGrade: false, onToggleColorGrade: jest.fn() });
    expect(screen.getByLabelText('AI 调色')).toBeDefined();
  });

  it('reflects the on state', () => {
    renderControls({ autoColorGrade: true, onToggleColorGrade: jest.fn() });
    expect(screen.getByLabelText('AI 调色')).toBeDefined();
  });

  it('fires the toggle handler on press', () => {
    const onToggleColorGrade = jest.fn();
    renderControls({ autoColorGrade: false, onToggleColorGrade, disabled: false });
    fireEvent.press(screen.getByLabelText('AI 调色'));
    expect(onToggleColorGrade).toHaveBeenCalledTimes(1);
  });

  it('hides the toggle when no handler is provided', () => {
    renderControls({});
    expect(screen.queryByLabelText('AI 调色')).toBeNull();
  });
});

describe('CameraGuidanceControls beauty toggle', () => {
  it('shows the AI beauty toggle when the handler is provided', () => {
    renderControls({ autoBeauty: false, onToggleBeauty: jest.fn() });
    expect(screen.getByLabelText('AI 美颜')).toBeDefined();
  });

  it('fires the beauty toggle handler on press', () => {
    const onToggleBeauty = jest.fn();
    renderControls({ autoBeauty: false, onToggleBeauty, disabled: false });
    fireEvent.press(screen.getByLabelText('AI 美颜'));
    expect(onToggleBeauty).toHaveBeenCalledTimes(1);
  });

  it('hides the beauty toggle when no handler is provided', () => {
    renderControls({});
    expect(screen.queryByLabelText('AI 美颜')).toBeNull();
  });
});

describe('CameraGuidanceControls scene toggle', () => {
  it('shows the AI scene toggle when the handler is provided', () => {
    renderControls({ autoScene: false, onToggleScene: jest.fn() });
    expect(screen.getByLabelText('AI 场景')).toBeDefined();
  });

  it('fires the scene toggle handler on press', () => {
    const onToggleScene = jest.fn();
    renderControls({ autoScene: false, onToggleScene, disabled: false });
    fireEvent.press(screen.getByLabelText('AI 场景'));
    expect(onToggleScene).toHaveBeenCalledTimes(1);
  });

  it('hides the scene toggle when no handler is provided', () => {
    renderControls({});
    expect(screen.queryByLabelText('AI 场景')).toBeNull();
  });
});
