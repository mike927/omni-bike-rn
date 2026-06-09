import { isAppleHealthSupported } from '../isAppleHealthSupported';

describe('isAppleHealthSupported', () => {
  it('returns true on iOS', () => {
    expect(isAppleHealthSupported('ios')).toBe(true);
  });
  it('returns false on Android', () => {
    expect(isAppleHealthSupported('android')).toBe(false);
  });
});
