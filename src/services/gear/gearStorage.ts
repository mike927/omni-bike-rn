import AsyncStorage from '@react-native-async-storage/async-storage';

import type { SavedDevice, SavedGear } from '../../types/gear';

const STORAGE_KEY = 'omni:savedGear';

const DEFAULT_GEAR: SavedGear = {
  savedBike: null,
  savedHrSource: null,
};

export async function loadSavedGear(): Promise<SavedGear> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_GEAR };
    return JSON.parse(raw) as SavedGear;
  } catch (err: unknown) {
    console.error('[gearStorage] Failed to load saved gear:', err);
    return { ...DEFAULT_GEAR };
  }
}

async function persist(gear: SavedGear): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(gear));
}

export async function saveBikeDevice(device: SavedDevice): Promise<void> {
  const current = await loadSavedGear();
  await persist({ ...current, savedBike: device });
}

export async function saveHrDevice(device: SavedDevice): Promise<void> {
  const current = await loadSavedGear();
  await persist({ ...current, savedHrSource: device });
}

export async function forgetBikeDevice(): Promise<void> {
  const current = await loadSavedGear();
  await persist({ ...current, savedBike: null });
}

export async function forgetHrDevice(): Promise<void> {
  const current = await loadSavedGear();
  await persist({ ...current, savedHrSource: null });
}
