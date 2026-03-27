import { renderHook, act } from '@testing-library/react-native';

import { useSavedGear } from '../useSavedGear';
import { useSavedGearStore } from '../../../../store/savedGearStore';
import type { SavedDevice } from '../../../../types/gear';

jest.mock('../../../../services/gear/gearStorage');

const bike: SavedDevice = { id: 'bike-uuid', name: 'Zipro Rave', type: 'bike' };
const hr: SavedDevice = { id: 'hr-uuid', name: 'Garmin HRM', type: 'hr' };

beforeEach(() => {
  useSavedGearStore.setState({
    savedBike: null,
    savedHrSource: null,
    hydrated: false,
    bikeReconnectState: 'idle',
    hrReconnectState: 'idle',
  });
});

describe('useSavedGear', () => {
  it('reflects hydrated state from store', () => {
    const { result } = renderHook(() => useSavedGear());
    expect(result.current.hydrated).toBe(false);

    act(() => {
      useSavedGearStore.setState({ hydrated: true });
    });

    expect(result.current.hydrated).toBe(true);
  });

  it('returns savedBike and savedHrSource from store', () => {
    useSavedGearStore.setState({ savedBike: bike, savedHrSource: hr });
    const { result } = renderHook(() => useSavedGear());
    expect(result.current.savedBike).toEqual(bike);
    expect(result.current.savedHrSource).toEqual(hr);
  });

  it('forgetBike calls removeBike on the store', async () => {
    const removeBike = jest.fn().mockResolvedValue(undefined);
    useSavedGearStore.setState({ savedBike: bike, removeBike });

    const { result } = renderHook(() => useSavedGear());

    await act(async () => {
      await result.current.forgetBike();
    });

    expect(removeBike).toHaveBeenCalled();
  });

  it('forgetHr calls removeHr on the store', async () => {
    const removeHr = jest.fn().mockResolvedValue(undefined);
    useSavedGearStore.setState({ savedHrSource: hr, removeHr });

    const { result } = renderHook(() => useSavedGear());

    await act(async () => {
      await result.current.forgetHr();
    });

    expect(removeHr).toHaveBeenCalled();
  });
});
