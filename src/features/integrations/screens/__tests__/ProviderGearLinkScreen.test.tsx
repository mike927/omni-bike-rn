import { render } from '@testing-library/react-native';

import { ProviderGearLinkScreen } from '../ProviderGearLinkScreen';
import type { UseProviderBikeLinkingResult } from '../../hooks/useProviderBikeLinking';

const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, back: mockBack, push: mockPush }),
}));

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return {
    SafeAreaView: View,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

const mockUseLinking = jest.fn();
jest.mock('../../hooks/useProviderBikeLinking', () => ({
  useProviderBikeLinking: (...args: unknown[]) => mockUseLinking(...args),
}));

const mockUseSavedGear = jest.fn();
jest.mock('../../../gear/hooks/useSavedGear', () => ({
  useSavedGear: (...args: unknown[]) => mockUseSavedGear(...args),
}));

function makeLinkingResult(overrides: Partial<UseProviderBikeLinkingResult> = {}): UseProviderBikeLinkingResult {
  return {
    currentLink: null,
    availableGear: [],
    selectedGearId: null,
    potentialMatches: [],
    status: 'not_linked',
    isLoading: false,
    isSaving: false,
    needsReconnect: false,
    errorMessage: null,
    selectGear: jest.fn(),
    confirmSelection: jest.fn(),
    clearLink: jest.fn(),
    refresh: jest.fn(),
    openProviderGearManagement: jest.fn(),
    ...overrides,
  };
}

describe('ProviderGearLinkScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders available provider bikes and a Link Bike action', () => {
    mockUseSavedGear.mockReturnValue({ savedBike: { id: 'b1', name: 'Wahoo KICKR Bike', type: 'bike' } });
    const gear = {
      providerId: 'strava',
      gearType: 'bike' as const,
      id: 'g1',
      name: 'Wahoo Kickr Bike',
      isPrimary: true,
    };
    mockUseLinking.mockReturnValue(
      makeLinkingResult({
        availableGear: [gear],
        selectedGearId: 'g1',
        potentialMatches: [gear],
      }),
    );

    const { getByText } = render(<ProviderGearLinkScreen providerId="strava" />);
    expect(getByText('Wahoo Kickr Bike')).toBeTruthy();
    expect(getByText('Link Bike')).toBeTruthy();
  });

  it('shows the bike-required state when no bike is saved', () => {
    mockUseSavedGear.mockReturnValue({ savedBike: null });
    mockUseLinking.mockReturnValue(makeLinkingResult());

    const { getByText } = render(<ProviderGearLinkScreen providerId="strava" />);
    expect(getByText('Save a bike in Omni Bike before linking provider gear.')).toBeTruthy();
  });
});
