import * as ReactNative from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import { getOnboardingPageIndex, getOnboardingPageWidth, OnboardingScreen } from '../OnboardingScreen';
import { useAppPreferencesStore } from '../../../../store/appPreferencesStore';

type ReactNativeModule = typeof ReactNative;

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
}));

jest.mock('../../../../store/appPreferencesStore', () => ({
  useAppPreferencesStore: jest.fn(),
}));

jest.mock('expo-linear-gradient', () => {
  const { View } = jest.requireActual<ReactNativeModule>('react-native');
  return { LinearGradient: View };
});

describe('OnboardingScreen', () => {
  const mockReplace = jest.fn();
  const mockCompleteOnboarding = jest.fn().mockResolvedValue(undefined);
  let useWindowDimensionsSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    useWindowDimensionsSpy = jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({
      width: 400,
      height: 800,
      scale: 1,
      fontScale: 1,
    });
    (useRouter as jest.Mock).mockReturnValue({ replace: mockReplace });
    (useAppPreferencesStore as unknown as jest.Mock).mockImplementation((selector: (state: object) => unknown) =>
      selector({ completeOnboarding: mockCompleteOnboarding }),
    );
  });

  afterEach(() => {
    useWindowDimensionsSpy.mockRestore();
  });

  it('renders the first onboarding page', () => {
    render(<OnboardingScreen />);

    expect(screen.getByText('See your ride in real time')).toBeTruthy();
    expect(screen.getByText('Search for Bike')).toBeTruthy();
    expect(screen.getAllByText('Skip').length).toBeGreaterThan(0);
  });

  it('completes onboarding when Skip is pressed on the last page (Finish CTA)', async () => {
    render(<OnboardingScreen />);

    fireEvent.press(screen.getByText('Search for Bike'));
    fireEvent.press(screen.getByText('Pair Device'));
    fireEvent.press(screen.getByText('Finish'));

    await waitFor(() => {
      expect(mockCompleteOnboarding).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith('/');
    });
  });

  it('maps scroll offsets using the full window page width', () => {
    const pageWidth = getOnboardingPageWidth(400);

    expect(pageWidth).toBe(400);
    expect(getOnboardingPageIndex(560, pageWidth)).toBe(1);
    expect(getOnboardingPageIndex(800, pageWidth)).toBe(2);
  });

  it('renders each per-page hero illustration', () => {
    render(<OnboardingScreen />);

    expect(screen.getByTestId('onboarding-illustration-bike')).toBeTruthy();
    expect(screen.getByTestId('onboarding-illustration-hr')).toBeTruthy();
    expect(screen.getByTestId('onboarding-illustration-start')).toBeTruthy();
  });

  it('advances to the next page when the primary CTA is pressed', () => {
    render(<OnboardingScreen />);

    fireEvent.press(screen.getByText('Search for Bike'));

    expect(screen.getByText('Pair Device')).toBeTruthy();
    expect(screen.getByText('Train to your heart rate')).toBeTruthy();
  });
});
