import { isAppleWatchAvailable } from '../isAppleWatchAvailable';

describe('isAppleWatchAvailable', () => {
  it('returns true on iPhone', () => {
    expect(isAppleWatchAvailable('ios', false)).toBe(true);
  });

  it('returns false on iPad', () => {
    expect(isAppleWatchAvailable('ios', true)).toBe(false);
  });

  it('returns false on Android', () => {
    expect(isAppleWatchAvailable('android', false)).toBe(false);
  });
});
