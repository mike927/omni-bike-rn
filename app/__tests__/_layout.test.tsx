import { Children, isValidElement, type ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import type * as ReactNative from 'react-native';

import RootLayout, { getOnboardingGateRedirect } from '../_layout';
import { initializeDatabase } from '../../src/services/db/migrations';
import { useSavedGearStore } from '../../src/store/savedGearStore';
import { useAppPreferencesStore } from '../../src/store/appPreferencesStore';
import { useProviderGearLinkStore } from '../../src/store/providerGearLinkStore';
import { useStravaConnectionStore } from '../../src/store/stravaConnectionStore';

const mockUseSegments = jest.fn();
const mockReactNative = jest.requireActual<typeof ReactNative>('react-native');
const MockStack = Object.assign(
  function MockStack({ children }: { children: ReactNode }) {
    return (
      <>
        {Children.map(children, (child) => {
          if (!isValidElement<{ name?: string }>(child) || typeof child.props.name !== 'string') {
            return null;
          }

          return <mockReactNative.Text key={child.props.name}>{child.props.name}</mockReactNative.Text>;
        })}
      </>
    );
  },
  {
    Screen() {
      return null;
    },
  },
);
const mockRedirect = jest.fn();

jest.mock('expo-router', () => {
  return {
    Redirect: ({ href }: { href: string }) => {
      mockRedirect(href);
      return <mockReactNative.Text>{`Redirect:${href}`}</mockReactNative.Text>;
    },
    Stack: MockStack,
    useSegments: () => mockUseSegments(),
  };
});

jest.mock('expo-status-bar', () => ({
  StatusBar: () => null,
}));

jest.mock('../../src/services/db/migrations', () => ({
  initializeDatabase: jest.fn(),
}));

jest.mock('../../src/store/savedGearStore', () => ({
  useSavedGearStore: jest.fn(),
}));

jest.mock('../../src/store/appPreferencesStore', () => ({
  useAppPreferencesStore: jest.fn(),
}));

jest.mock('../../src/store/providerGearLinkStore', () => ({
  useProviderGearLinkStore: jest.fn(),
}));

jest.mock('../../src/store/stravaConnectionStore', () => ({
  useStravaConnectionStore: jest.fn(),
}));

jest.mock('../../src/features/training/hooks/useTrainingSessionPersistence', () => ({
  useTrainingSessionPersistence: jest.fn(),
}));

jest.mock('../../src/features/training/hooks/useInterruptedSessionRecovery', () => ({
  useInterruptedSessionRecovery: jest.fn(),
}));

jest.mock('../../src/features/gear/hooks/useWatchHr', () => ({
  useWatchHr: jest.fn(),
}));

describe('RootLayout onboarding gate', () => {
  const savedGearState = {
    hydrate: jest.fn().mockResolvedValue(undefined),
  };

  const appPreferencesState = {
    hydrate: jest.fn().mockResolvedValue(undefined),
    hydrated: true,
    onboardingCompleted: false,
  };

  const providerGearLinkState = {
    hydrate: jest.fn().mockResolvedValue(undefined),
    hydrated: true,
  };

  const stravaConnectionState = {
    hydrate: jest.fn().mockResolvedValue(undefined),
    hydrated: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (initializeDatabase as jest.Mock).mockResolvedValue(undefined);
    mockUseSegments.mockReturnValue([]);
    (useSavedGearStore as unknown as jest.Mock).mockImplementation((selector: (state: object) => unknown) =>
      selector(savedGearState),
    );
    (useAppPreferencesStore as unknown as jest.Mock).mockImplementation((selector: (state: object) => unknown) =>
      selector(appPreferencesState),
    );
    (useProviderGearLinkStore as unknown as jest.Mock).mockImplementation((selector: (state: object) => unknown) =>
      selector(providerGearLinkState),
    );
    (useStravaConnectionStore as unknown as jest.Mock).mockImplementation((selector: (state: object) => unknown) =>
      selector(stravaConnectionState),
    );
  });

  it('starts from onboarding for first launch users', async () => {
    appPreferencesState.onboardingCompleted = false;
    mockUseSegments.mockReturnValue([]);

    render(<RootLayout />);

    await waitFor(() => {
      expect(screen.getByText('Redirect:/onboarding')).toBeTruthy();
      expect(mockRedirect).toHaveBeenCalledWith('/onboarding');
    });
  });

  it('does not redirect first launch users who are already on onboarding', () => {
    expect(getOnboardingGateRedirect(['onboarding'], false)).toBeNull();
  });

  it('redirects completed users away from onboarding', async () => {
    appPreferencesState.onboardingCompleted = true;
    mockUseSegments.mockReturnValue(['onboarding']);

    render(<RootLayout />);

    await waitFor(() => {
      expect(screen.getByText('Redirect:/')).toBeTruthy();
      expect(mockRedirect).toHaveBeenCalledWith('/');
    });
  });

  it('does not redirect completed users who are already inside tabs', () => {
    expect(getOnboardingGateRedirect(['(tabs)'], true)).toBeNull();
  });
});
