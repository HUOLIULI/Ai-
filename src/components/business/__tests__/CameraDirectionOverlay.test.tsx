import React from 'react';
import { render } from '@testing-library/react-native';
import { CameraDirectionOverlay } from '../CameraDirectionOverlay';

describe('CameraDirectionOverlay thirds grid', () => {
  it('renders the thirds grid when guidance is enabled with a target', () => {
    const { getByTestId } = render(
      <CameraDirectionOverlay target={{ x: 0.5, y: 0.5, phase: 'aiming' }} enabled width={300} height={400} />,
    );
    expect(getByTestId('thirds-grid')).toBeDefined();
  });

  it('renders the thirds grid even without an active target while enabled', () => {
    const { getByTestId } = render(
      <CameraDirectionOverlay target={null} enabled width={300} height={400} />,
    );
    expect(getByTestId('thirds-grid')).toBeDefined();
  });

  it('hides the thirds grid when guidance is disabled', () => {
    const { queryByTestId } = render(
      <CameraDirectionOverlay target={null} enabled={false} width={300} height={400} />,
    );
    expect(queryByTestId('thirds-grid')).toBeNull();
  });
});
