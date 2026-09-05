import { useSessionPersistenceStore } from '../sessionPersistenceStore';

/**
 * Audit A02: this store is what the session controller consults before it tears
 * a ride down, so every claim it makes about disk has to be true for the ride
 * the app is actually holding.
 *
 * The property under test is the per-session-id keying. Writes are queued and
 * settle out of order with the lifecycle, so a report from a ride that is over
 * can land after the next ride has started. Whichever way it lands, it must not
 * be able to say anything about the ride that is running now.
 */
describe('sessionPersistenceStore', () => {
  beforeEach(() => {
    useSessionPersistenceStore.getState().clear();
  });

  const store = () => useSessionPersistenceStore.getState();

  it('takes ownership of a ride without claiming a durable row yet', () => {
    store().beginSession('session-new');

    // `pending`, not `recording`: the draft write is only queued at this point.
    expect(store().status).toBe('pending');
    expect(store().sessionId).toBe('session-new');
    expect(store().droppedSampleCount).toBe(0);
    expect(store().lastErrorMessage).toBeNull();
  });

  it('promotes the ride to recording once its row exists', () => {
    store().beginSession('session-new');
    store().markRecording('session-new');

    expect(store().status).toBe('recording');
  });

  it('refuses a stale failure report from an abandoned ride', () => {
    store().beginSession('session-old');
    store().beginSession('session-new');
    store().markRecording('session-new');

    store().markUnsaved('session-old', 'disk full');

    // The new ride is on disk and must not inherit the old ride's failure: the
    // controller would refuse to finish a perfectly saved ride.
    expect(store().status).toBe('recording');
    expect(store().lastErrorMessage).toBeNull();
  });

  it('refuses a stale success report from an abandoned ride', () => {
    store().beginSession('session-old');
    store().beginSession('session-new');
    store().markUnsaved('session-new', 'disk full');

    store().markSaved('session-old');

    // The dangerous direction: a late success from a ride that is over would let
    // the controller tear down a ride that is not on disk.
    expect(store().status).toBe('unsaved');
    expect(store().lastErrorMessage).toBe('disk full');
  });

  it('refuses stale recording, at-risk and dropped-sample reports', () => {
    store().beginSession('session-old');
    store().beginSession('session-new');
    store().markUnsaved('session-new', 'disk full');

    store().markRecording('session-old');
    store().markAtRisk('session-old', 'stale warning');
    store().markSampleDropped('session-old', 'stale sample');

    expect(store().status).toBe('unsaved');
    expect(store().droppedSampleCount).toBe(0);
    expect(store().lastErrorMessage).toBe('disk full');
  });

  it('accepts every report that belongs to the ride it is tracking', () => {
    store().beginSession('session-1');

    store().markAtRisk('session-1', 'disk full');
    expect(store().status).toBe('atRisk');
    expect(store().lastErrorMessage).toBe('disk full');

    store().markSampleDropped('session-1', 'sample lost');
    store().markSampleDropped('session-1', 'sample lost');
    expect(store().droppedSampleCount).toBe(2);

    store().markSaved('session-1');
    expect(store().status).toBe('saved');
    expect(store().lastErrorMessage).toBeNull();
  });

  it('answers to nobody once the ride is cleared', () => {
    store().beginSession('session-1');
    store().markUnsaved('session-1', 'disk full');

    store().clear();

    expect(store().status).toBe('idle');
    expect(store().sessionId).toBeNull();
    expect(store().droppedSampleCount).toBe(0);
    expect(store().lastErrorMessage).toBeNull();

    store().markUnsaved('session-1', 'disk full');

    expect(store().status).toBe('idle');
  });
});
