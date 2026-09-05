import { create } from 'zustand';

/**
 * Whether the ride currently in memory is safe on disk.
 *
 * A ride is global state that the user cannot get back once it is gone, so the
 * durable outcome of writing it is part of the session lifecycle rather than a
 * fire-and-forget side effect (audit A02). The persistence subscriber owns the
 * writes and reports them here; the session controller reads this to decide
 * whether a Finish may complete, and the Training screen renders it so a write
 * failure is never silent.
 *
 *  - `idle`      nothing is being recorded.
 *  - `pending`   the ride has started and its draft write has not landed yet.
 *  - `recording` the ride has a durable draft row.
 *  - `atRisk`    the ride is running but nothing durable exists for it yet.
 *  - `saved`     the finished ride is on disk.
 *  - `unsaved`   the ride is finished and its durable save failed.
 */
export type SessionPersistenceStatus = 'idle' | 'pending' | 'recording' | 'atRisk' | 'saved' | 'unsaved';

export interface SessionPersistenceStore {
  status: SessionPersistenceStatus;
  /** Identity of the ride these writes belong to. Stable across retries. */
  sessionId: string | null;
  /**
   * Per-second samples abandoned because their write failed. Counted, never
   * buffered: a broken disk must not be able to grow the app's memory during a
   * ride, and the ride totals are rewritten in full when it is finalized.
   */
  droppedSampleCount: number;
  lastErrorMessage: string | null;

  /** Take ownership of a new ride. Nothing durable exists for it yet. */
  beginSession: (sessionId: string) => void;
  markRecording: (sessionId: string) => void;
  markAtRisk: (sessionId: string, message: string) => void;
  markSaved: (sessionId: string) => void;
  markSampleDropped: (sessionId: string, message: string) => void;
  markUnsaved: (sessionId: string, message: string) => void;
  clear: () => void;
}

const IDLE_STATE = {
  status: 'idle' as SessionPersistenceStatus,
  sessionId: null,
  droppedSampleCount: 0,
  lastErrorMessage: null,
};

export const useSessionPersistenceStore = create<SessionPersistenceStore>((set, get) => ({
  ...IDLE_STATE,

  // `pending`, not `recording`: the draft write is queued at this point and has
  // not run, so claiming a durable row here would be a claim about disk that
  // nothing has checked yet. `markRecording` promotes it once the row exists.
  beginSession: (sessionId) => set({ status: 'pending', sessionId, droppedSampleCount: 0, lastErrorMessage: null }),

  // Every report below is ignored unless it belongs to the ride being tracked,
  // so a late write from an abandoned ride cannot flag the current one.
  markRecording: (sessionId) => {
    if (get().sessionId !== sessionId) return;
    set({ status: 'recording', lastErrorMessage: null });
  },

  markAtRisk: (sessionId, message) => {
    if (get().sessionId !== sessionId) return;
    set({ status: 'atRisk', lastErrorMessage: message });
  },

  markSaved: (sessionId) => {
    if (get().sessionId !== sessionId) return;
    set({ status: 'saved', lastErrorMessage: null });
  },

  markSampleDropped: (sessionId, message) => {
    if (get().sessionId !== sessionId) return;
    set({ droppedSampleCount: get().droppedSampleCount + 1, lastErrorMessage: message });
  },

  markUnsaved: (sessionId, message) => {
    if (get().sessionId !== sessionId) return;
    set({ status: 'unsaved', lastErrorMessage: message });
  },

  clear: () => set({ ...IDLE_STATE }),
}));
