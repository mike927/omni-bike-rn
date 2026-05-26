import {
  resolveWatchAvailability,
  WATCH_IDLE_GRACE_MS,
  WATCH_WORKOUT_GRACE_MS,
  type WatchContactInput,
} from '../watchAvailability';

const base: WatchContactInput = { isReachable: false, workoutActive: false, lastContactAtMs: null, nowMs: 100_000 };

describe('resolveWatchAvailability', () => {
  it('connected when reachable, regardless of contact age', () => {
    expect(resolveWatchAvailability({ ...base, isReachable: true, lastContactAtMs: null })).toBe('connected');
  });
  it('connected within the idle grace after losing reachability', () => {
    expect(resolveWatchAvailability({ ...base, lastContactAtMs: 100_000 - WATCH_IDLE_GRACE_MS + 1 })).toBe('connected');
  });
  it('unavailable once idle grace elapses with no contact', () => {
    expect(resolveWatchAvailability({ ...base, lastContactAtMs: 100_000 - WATCH_IDLE_GRACE_MS - 1 })).toBe(
      'unavailable',
    );
  });
  it('workout widens the grace: still connected past idle grace but within workout grace', () => {
    expect(
      resolveWatchAvailability({
        ...base,
        workoutActive: true,
        lastContactAtMs: 100_000 - WATCH_IDLE_GRACE_MS - 5_000,
      }),
    ).toBe('connected');
  });
  it('workout grace also expires: unavailable past the workout grace (mid-ride kill)', () => {
    expect(
      resolveWatchAvailability({ ...base, workoutActive: true, lastContactAtMs: 100_000 - WATCH_WORKOUT_GRACE_MS - 1 }),
    ).toBe('unavailable');
  });
  it('unavailable when never contacted and not reachable', () => {
    expect(resolveWatchAvailability({ ...base, lastContactAtMs: null })).toBe('unavailable');
  });
});
