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

  it('hides the Apple Watch row when no Watch is available', () => {
    const { getByText, queryByText } = renderTile({ watchAvailable: false });
    fireEvent.press(getByText('Heart Rate Source'));
    expect(queryByText('Apple Watch')).toBeNull();
    expect(getByText('Bluetooth HR')).toBeTruthy();
  });

  it('shows the Apple Watch row with an Enable button when Watch HR is off', () => {
    const onEnableWatch = jest.fn();
    const { getByText } = renderTile({ watchAvailable: true, watchHrEnabled: false, onEnableWatch });
    fireEvent.press(getByText('Heart Rate Source'));
    expect(getByText('Apple Watch')).toBeTruthy();
    fireEvent.press(getByText('Enable'));
    expect(onEnableWatch).toHaveBeenCalledTimes(1);
  });

  it('shows a Disable button that fires the disable callback when Watch HR is on', () => {
    const onDisableWatch = jest.fn();
    const { getByText } = renderTile({ watchAvailable: true, watchHrEnabled: true, onDisableWatch });
    fireEvent.press(getByText('Heart Rate Source'));
    fireEvent.press(getByText('Disable'));
    expect(onDisableWatch).toHaveBeenCalledTimes(1);
  });

  it('appends the live bpm to the Watch status only when in progress', () => {
    const { getByText } = renderTile({
      watchAvailable: true,
      watchHrEnabled: true,
      watchHrDisplayState: 'in_progress',
      latestAppleWatchHr: 132,
    });
    fireEvent.press(getByText('Heart Rate Source'));
    expect(getByText('In Progress · 132 bpm')).toBeTruthy();
  });

  it('reports the Bluetooth connection state in the detail panel', () => {
    const { getByText } = renderTile({ bluetoothConnected: true });
    fireEvent.press(getByText('Heart Rate Source'));
    expect(getByText('Connected')).toBeTruthy();
  });
});
