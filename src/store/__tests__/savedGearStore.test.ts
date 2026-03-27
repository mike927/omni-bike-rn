import { useSavedGearStore } from '../savedGearStore';
import * as gearStorage from '../../services/gear/gearStorage';
import type { SavedDevice } from '../../types/gear';

jest.mock('../../services/gear/gearStorage');

const mockLoadSavedGear = gearStorage.loadSavedGear as jest.Mock;
const mockSaveBikeDevice = gearStorage.saveBikeDevice as jest.Mock;
const mockSaveHrDevice = gearStorage.saveHrDevice as jest.Mock;
const mockForgetBikeDevice = gearStorage.forgetBikeDevice as jest.Mock;
const mockForgetHrDevice = gearStorage.forgetHrDevice as jest.Mock;

const bike: SavedDevice = { id: 'bike-uuid', name: 'Zipro Rave', type: 'bike' };
const hr: SavedDevice = { id: 'hr-uuid', name: 'Garmin HRM', type: 'hr' };

beforeEach(() => {
  jest.clearAllMocks();
  useSavedGearStore.setState({
    savedBike: null,
    savedHrSource: null,
    hydrated: false,
    bikeReconnectState: 'idle',
    hrReconnectState: 'idle',
  });
  mockSaveBikeDevice.mockResolvedValue(undefined);
  mockSaveHrDevice.mockResolvedValue(undefined);
  mockForgetBikeDevice.mockResolvedValue(undefined);
  mockForgetHrDevice.mockResolvedValue(undefined);
});

describe('hydrate', () => {
  it('loads gear from storage and sets hydrated', async () => {
    mockLoadSavedGear.mockResolvedValue({ savedBike: bike, savedHrSource: hr });
    await useSavedGearStore.getState().hydrate();
    const state = useSavedGearStore.getState();
    expect(state.savedBike).toEqual(bike);
    expect(state.savedHrSource).toEqual(hr);
    expect(state.hydrated).toBe(true);
  });

  it('does not reload if already hydrated', async () => {
    mockLoadSavedGear.mockResolvedValue({ savedBike: bike, savedHrSource: null });
    useSavedGearStore.setState({ hydrated: true });
    await useSavedGearStore.getState().hydrate();
    expect(mockLoadSavedGear).not.toHaveBeenCalled();
  });
});

describe('setSavedBike', () => {
  it('updates savedBike in state', () => {
    useSavedGearStore.getState().setSavedBike(bike);
    expect(useSavedGearStore.getState().savedBike).toEqual(bike);
  });

  it('clears savedBike when null', () => {
    useSavedGearStore.setState({ savedBike: bike });
    useSavedGearStore.getState().setSavedBike(null);
    expect(useSavedGearStore.getState().savedBike).toBeNull();
  });
});

describe('persistBike', () => {
  it('persists to storage and updates state', async () => {
    await useSavedGearStore.getState().persistBike(bike);
    expect(mockSaveBikeDevice).toHaveBeenCalledWith(bike);
    expect(useSavedGearStore.getState().savedBike).toEqual(bike);
  });
});

describe('persistHr', () => {
  it('persists to storage and updates state', async () => {
    await useSavedGearStore.getState().persistHr(hr);
    expect(mockSaveHrDevice).toHaveBeenCalledWith(hr);
    expect(useSavedGearStore.getState().savedHrSource).toEqual(hr);
  });
});

describe('removeBike', () => {
  it('forgets from storage, clears state, resets reconnect state', async () => {
    useSavedGearStore.setState({ savedBike: bike, bikeReconnectState: 'connected' });
    await useSavedGearStore.getState().removeBike();
    expect(mockForgetBikeDevice).toHaveBeenCalled();
    const state = useSavedGearStore.getState();
    expect(state.savedBike).toBeNull();
    expect(state.bikeReconnectState).toBe('idle');
  });
});

describe('removeHr', () => {
  it('forgets from storage, clears state, resets reconnect state', async () => {
    useSavedGearStore.setState({ savedHrSource: hr, hrReconnectState: 'failed' });
    await useSavedGearStore.getState().removeHr();
    expect(mockForgetHrDevice).toHaveBeenCalled();
    const state = useSavedGearStore.getState();
    expect(state.savedHrSource).toBeNull();
    expect(state.hrReconnectState).toBe('idle');
  });
});

describe('reconnect state transitions', () => {
  it('transitions bike reconnect state correctly', () => {
    useSavedGearStore.getState().setBikeReconnectState('connecting');
    expect(useSavedGearStore.getState().bikeReconnectState).toBe('connecting');
    useSavedGearStore.getState().setBikeReconnectState('connected');
    expect(useSavedGearStore.getState().bikeReconnectState).toBe('connected');
    useSavedGearStore.getState().setBikeReconnectState('failed');
    expect(useSavedGearStore.getState().bikeReconnectState).toBe('failed');
    useSavedGearStore.getState().setBikeReconnectState('idle');
    expect(useSavedGearStore.getState().bikeReconnectState).toBe('idle');
  });

  it('transitions HR reconnect state correctly', () => {
    useSavedGearStore.getState().setHrReconnectState('connecting');
    expect(useSavedGearStore.getState().hrReconnectState).toBe('connecting');
    useSavedGearStore.getState().setHrReconnectState('failed');
    expect(useSavedGearStore.getState().hrReconnectState).toBe('failed');
  });
});
