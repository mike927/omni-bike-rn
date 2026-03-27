import AsyncStorage from '@react-native-async-storage/async-storage';

import { loadSavedGear, saveBikeDevice, saveHrDevice, forgetBikeDevice, forgetHrDevice } from '../gearStorage';
import type { SavedDevice } from '../../../types/gear';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const mockGetItem = AsyncStorage.getItem as jest.Mock;
const mockSetItem = AsyncStorage.setItem as jest.Mock;

const bike: SavedDevice = { id: 'bike-uuid', name: 'Zipro Rave', type: 'bike' };
const hr: SavedDevice = { id: 'hr-uuid', name: 'Garmin HRM', type: 'hr' };

beforeEach(() => {
  jest.clearAllMocks();
  mockSetItem.mockResolvedValue(undefined);
});

describe('loadSavedGear', () => {
  it('returns defaults when nothing is stored', async () => {
    mockGetItem.mockResolvedValue(null);
    const gear = await loadSavedGear();
    expect(gear).toEqual({ savedBike: null, savedHrSource: null });
  });

  it('returns parsed gear when stored', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify({ savedBike: bike, savedHrSource: hr }));
    const gear = await loadSavedGear();
    expect(gear).toEqual({ savedBike: bike, savedHrSource: hr });
  });

  it('returns defaults when storage throws', async () => {
    mockGetItem.mockRejectedValue(new Error('storage failure'));
    const gear = await loadSavedGear();
    expect(gear).toEqual({ savedBike: null, savedHrSource: null });
  });
});

describe('saveBikeDevice', () => {
  it('saves bike while preserving existing HR source', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify({ savedBike: null, savedHrSource: hr }));
    await saveBikeDevice(bike);
    expect(mockSetItem).toHaveBeenCalledWith('omni:savedGear', JSON.stringify({ savedBike: bike, savedHrSource: hr }));
  });
});

describe('saveHrDevice', () => {
  it('saves HR source while preserving existing bike', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify({ savedBike: bike, savedHrSource: null }));
    await saveHrDevice(hr);
    expect(mockSetItem).toHaveBeenCalledWith('omni:savedGear', JSON.stringify({ savedBike: bike, savedHrSource: hr }));
  });
});

describe('forgetBikeDevice', () => {
  it('clears bike while preserving HR source', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify({ savedBike: bike, savedHrSource: hr }));
    await forgetBikeDevice();
    expect(mockSetItem).toHaveBeenCalledWith('omni:savedGear', JSON.stringify({ savedBike: null, savedHrSource: hr }));
  });
});

describe('forgetHrDevice', () => {
  it('clears HR source while preserving bike', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify({ savedBike: bike, savedHrSource: hr }));
    await forgetHrDevice();
    expect(mockSetItem).toHaveBeenCalledWith(
      'omni:savedGear',
      JSON.stringify({ savedBike: bike, savedHrSource: null }),
    );
  });
});

describe('round-trip', () => {
  it('saves and loads gear correctly', async () => {
    let stored: string | null = null;
    mockSetItem.mockImplementation((_key: string, value: string) => {
      stored = value;
      return Promise.resolve();
    });
    mockGetItem.mockImplementation(() => Promise.resolve(stored));

    await saveBikeDevice(bike);
    await saveHrDevice(hr);

    const gear = await loadSavedGear();
    expect(gear).toEqual({ savedBike: bike, savedHrSource: hr });
  });
});
