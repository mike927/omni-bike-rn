import Storage from 'expo-sqlite/kv-store';

const STORAGE_KEY = 'omni:appleHealthConnected';

export async function loadAppleHealthConnected(): Promise<boolean> {
  try {
    const raw = await Storage.getItem(STORAGE_KEY);
    return raw === 'true';
  } catch (err: unknown) {
    console.error('[appleHealthConnectionStorage] Failed to load connection flag:', err);
    return false;
  }
}

export async function setAppleHealthConnected(connected: boolean): Promise<void> {
  await Storage.setItem(STORAGE_KEY, connected ? 'true' : 'false');
}
