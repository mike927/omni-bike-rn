import * as ReactNative from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { getOnboardingPageIndex, getOnboardingPageWidth, OnboardingScreen } from '../OnboardingScreen';
import { useAppPreferencesStore } from '../../../../store/appPreferencesStore';
import { useSavedGearStore } from '../../../../store/savedGearStore';

type ReactNativeModule = typeof ReactNative;

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useFocusEffect: jest.fn(),
}));

jest.mock('../../../../store/appPreferencesStore', () => ({
  useAppPreferencesStore: jest.fn(),
}));

jest.mock('../../../../store/savedGearStore', () => ({
  useSavedGearStore: jest.fn(),
}));

jest.mock('expo-linear-gradient', () => {
  const { View } = jest.requireActual<ReactNativeModule>('react-native');
  return { LinearGradient: View };
});

describe('OnboardingScreen', () => {
  const mockReplace = jest.fn();
  const mockPush = jest.fn();
  const mockCompleteOnboarding = jest.fn().mockResolvedValue(undefined);
  let useWindowDimensionsSpy: jest.SpyInstance;
  let savedGearState: { savedBike: unknown; savedHrSource: unknown };
  let focusCallback: (() => void | (() => void)) | null;

  beforeEach(() => {
    jest.clearAllMocks();
    focusCallback = null;
    savedGearState = { savedBike: null, savedHrSource: null };
    useWindowDimensionsSpy = jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({
      width: 400,
      height: 800,
      scale: 1,
      fontScale: 1,
    });
    (useRouter as jest.Mock).mockReturnValue({ replace: mockReplace, push: mockPush });
    (useAppPreferencesStore as unknown as jest.Mock).mockImplementation((selector: (state: object) => unknown) =>
      selector({ completeOnboarding: mockCompleteOnboarding }),
    );
    (useSavedGearStore as unknown as jest.Mock).mockImplementation((selector: (state: object) => unknown) =>
      selector(savedGearState),
    );
    (useFocusEffect as jest.Mock).mockImplementation((callback: () => void) => {
      focusCallback = callback;
      callback();
    });
  });

  afterEach(() => {
    useWindowDimensionsSpy.mockRestore();
  });

  it('renders the first onboarding page', () => {
    render(<OnboardingScreen />);

    expect(screen.getByText('See your ride in real time')).toBeTruthy();
    expect(screen.getByText('Search for Bike')).toBeTruthy();
    expect(screen.getByText('Skip')).toBeTruthy();
  });

  it('opens the modal pairing flow for bike on page 1 primary CTA', () => {
    render(<OnboardingScreen />);

    fireEvent.press(screen.getByText('Search for Bike'));

    expect(mockPush).toHaveBeenCalledWith('/onboarding-gear-setup?target=bike');
    // Primary CTA must not advance the carousel on pages 1-2.
    expect(screen.getByText('Search for Bike')).toBeTruthy();
  });

  it('opens the modal pairing flow for HR on page 2 primary CTA', () => {
    render(<OnboardingScreen />);

    fireEvent.press(screen.getByText('Skip'));
    fireEvent.press(screen.getByText('Pair Device'));

    expect(mockPush).toHaveBeenCalledWith('/onboarding-gear-setup?target=hr');
  });

  it('completes onboarding when Finish is pressed on the last page', async () => {
    render(<OnboardingScreen />);

    fireEvent.press(screen.getByText('Skip'));
    fireEvent.press(screen.getByText('Skip'));
    fireEvent.press(screen.getByText('Finish'));

    await waitFor(() => {
      expect(mockCompleteOnboarding).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith('/');
    });
  });

  it('auto-advances from bike page to HR page after a new bike is paired', () => {
    const { rerender } = render(<OnboardingScreen />);

    expect(screen.getByText('See your ride in real time')).toBeTruthy();

    savedGearState.savedBike = { id: 'dev-1', name: 'Zipro' } as unknown;
    rerender(<OnboardingScreen />);
    focusCallback?.();

    expect(screen.getByText('Train to your heart rate')).toBeTruthy();
  });

  it('does not advance when focus returns without saving a bike', () => {
    render(<OnboardingScreen />);
    focusCallback?.();

    expect(screen.getByText('See your ride in real time')).toBeTruthy();
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
});
