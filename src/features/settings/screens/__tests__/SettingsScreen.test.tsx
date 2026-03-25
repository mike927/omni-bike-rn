import { render } from '@testing-library/react-native';

import { SettingsScreen } from '../SettingsScreen';

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return {
    SafeAreaView: View,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

jest.mock('../../../training/hooks/useDeviceConnection', () => ({
  useDeviceConnection: () => ({
    bikeConnected: false,
    hrConnected: false,
    latestBikeMetrics: null,
    latestHr: null,
    connectBike: jest.fn(),
    connectHr: jest.fn(),
    disconnectAll: jest.fn(),
  }),
}));

describe('SettingsScreen', () => {
  it('renders without crashing', () => {
    expect(() => render(<SettingsScreen />)).not.toThrow();
  });

  it('shows the Settings heading', () => {
    const { getByText } = render(<SettingsScreen />);
    expect(getByText('Settings')).toBeTruthy();
  });
});
