import { fireEvent, render } from '@testing-library/react-native';

import { HeartRateSourceTile, type HeartRateSourceTileProps } from '../HeartRateSourceTile';

function renderTile(overrides: Partial<HeartRateSourceTileProps> = {}) {
  const props: HeartRateSourceTileProps = {
    activeHrSource: 'none',
    watchAvailable: true,
    watchHrEnabled: false,
    watchHrDisplayState: 'idle',
    latestAppleWatchHr: null,
    bluetoothConnected: false,
    onEnableWatch: jest.fn(),
    onDisableWatch: jest.fn(),
    ...overrides,
  };
  return { props, ...render(<HeartRateSourceTile {...props} />) };
}

describe('HeartRateSourceTile', () => {
  it('shows the active source label when collapsed', () => {
    const { getByText } = renderTile({ activeHrSource: 'bluetooth' });
    expect(getByText('Bluetooth HR')).toBeTruthy();
  });

  it('shows "No HR source" when nothing is active', () => {
    const { getByText } = renderTile({ activeHrSource: 'none' });
    expect(getByText('No HR source')).toBeTruthy();
  });

  it('keeps the source detail hidden until the header is pressed', () => {
    const { getByText, queryByText } = renderTile({ activeHrSource: 'none' });
    expect(queryByText('Bluetooth HR')).toBeNull();
    fireEvent.press(getByText('Heart Rate Source'));
    expect(getByText('Bluetooth HR')).toBeTruthy();
  });
});
