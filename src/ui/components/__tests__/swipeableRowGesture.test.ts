import { clampSwipeTranslate, resolveSwipeOpen } from '../swipeableRowGesture';

describe('clampSwipeTranslate', () => {
  const openX = -156;

  it('follows a left drag from the closed resting offset', () => {
    expect(clampSwipeTranslate({ startX: -8, dx: -50, openX })).toBe(-58);
  });

  it('clamps to the fully-open offset when over-dragged left', () => {
    expect(clampSwipeTranslate({ startX: -100, dx: -200, openX })).toBe(openX);
  });

  it('clamps to 0 (fully closed) when dragged right past the rest point', () => {
    expect(clampSwipeTranslate({ startX: -8, dx: 50, openX })).toBe(0);
  });
});

describe('resolveSwipeOpen', () => {
  const openWidth = 152;

  it('opens on a fast left fling regardless of position', () => {
    expect(resolveSwipeOpen({ translateX: -10, velocityX: -1.2, openWidth })).toBe(true);
  });

  it('closes on a fast right fling regardless of position', () => {
    expect(resolveSwipeOpen({ translateX: -140, velocityX: 1.2, openWidth })).toBe(false);
  });

  it('opens when dragged past halfway with low velocity', () => {
    expect(resolveSwipeOpen({ translateX: -100, velocityX: 0, openWidth })).toBe(true);
  });

  it('closes when dragged less than halfway with low velocity', () => {
    expect(resolveSwipeOpen({ translateX: -40, velocityX: 0, openWidth })).toBe(false);
  });

  it('treats the exact halfway point as not-yet-open', () => {
    expect(resolveSwipeOpen({ translateX: -76, velocityX: 0, openWidth })).toBe(false);
  });
});
