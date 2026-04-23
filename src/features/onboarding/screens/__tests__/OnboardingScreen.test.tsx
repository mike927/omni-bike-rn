import * as ReactNative from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import { getOnboardingPageIndex, getOnboardingPageWidth, OnboardingScreen } from '../OnboardingScreen';
import { useAppPreferencesStore } from '../../../../store/appPreferencesStore';

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
}));

jest.mock('../../../../store/appPreferencesStore', () => ({
  useAppPreferencesStore: jest.fn(),
}));

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

    expect(screen.getByText('Welcome to Omni Bike')).toBeTruthy();
    expect(screen.getByText('Connect your bike')).toBeTruthy();
    expect(screen.getByText('Next')).toBeTruthy();
  });

  it('completes onboarding when Skip is pressed', async () => {
    render(<OnboardingScreen />);

    fireEvent.press(screen.getByText('Skip'));

    await waitFor(() => {
      expect(mockCompleteOnboarding).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith('/');
    });
  });

  it('shows Done on the last page and completes onboarding', async () => {
    render(<OnboardingScreen />);

    fireEvent.press(screen.getByLabelText('Go to onboarding page 3'));
    fireEvent.press(screen.getByText('Done'));

    await waitFor(() => {
      expect(mockCompleteOnboarding).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith('/');
    });
  });

  it('maps scroll offsets using the padded onboarding page width', () => {
    const pageWidth = getOnboardingPageWidth(400);

    expect(pageWidth).toBe(360);
    expect(getOnboardingPageIndex(560, pageWidth)).toBe(2);
  });

  it('renders each per-page hero illustration', () => {
    render(<OnboardingScreen />);

    expect(screen.getByTestId('onboarding-illustration-bike')).toBeTruthy();
    expect(screen.getByTestId('onboarding-illustration-hr')).toBeTruthy();
    expect(screen.getByTestId('onboarding-illustration-start')).toBeTruthy();
  });

  it('navigates to the requested page when a dot is pressed', () => {
    render(<OnboardingScreen />);

    fireEvent.press(screen.getByLabelText('Go to onboarding page 2'));

    expect(screen.getByText('Add heart rate if you want it')).toBeTruthy();
    expect(screen.getByText('Next')).toBeTruthy();
  });

  it('triggers onPress when the OnboardingActionButton primary is pressed', async () => {
    render(<OnboardingScreen />);

    fireEvent.press(screen.getByLabelText('Go to onboarding page 3'));
    fireEvent.press(screen.getByText('Done'));

    await waitFor(() => {
      expect(mockCompleteOnboarding).toHaveBeenCalledTimes(1);
    });
  });
});
