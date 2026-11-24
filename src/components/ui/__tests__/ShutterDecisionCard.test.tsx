import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ShutterDecisionCard } from '../ShutterDecisionCard';
import type { ShutterDecision } from '../../../lib/shutterDecision';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

const decision: ShutterDecision = {
  whiteBalance: 'cloudy',
  style: '奶杏',
  exposure: { level: 'dark', hint: '画面偏暗，建议开闪光或补光后再拍。' },
  stability: { level: 'shaky', hint: '手持不稳，请稳住再拍，避免成片模糊。' },
  reasons: ['采样帧亮度偏暗'],
};

describe('ShutterDecisionCard', () => {
  it('renders exposure and stability hints for a decision', () => {
    render(<ShutterDecisionCard decision={decision} />);
    expect(screen.getByText(decision.exposure.hint)).toBeTruthy();
    expect(screen.getByText(decision.stability.hint)).toBeTruthy();
  });

  it('renders nothing when there is no decision yet', () => {
    const { toJSON } = render(<ShutterDecisionCard decision={null} />);
    expect(toJSON()).toBeNull();
  });
});
