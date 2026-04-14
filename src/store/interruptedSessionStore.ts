import { create } from 'zustand';

import type { PersistedTrainingSession } from '../types/sessionPersistence';

interface InterruptedSessionStore {
  interruptedSession: PersistedTrainingSession | null;
  setInterruptedSession: (session: PersistedTrainingSession | null) => void;
  clear: () => void;
}

export const useInterruptedSessionStore = create<InterruptedSessionStore>((set) => ({
  interruptedSession: null,
  setInterruptedSession: (session) => set({ interruptedSession: session }),
  clear: () => set({ interruptedSession: null }),
}));
