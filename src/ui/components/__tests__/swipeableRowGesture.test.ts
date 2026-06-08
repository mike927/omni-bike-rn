import { clampSwipeTranslate, resolveSwipeOpen, resolveSwipeRelease } from '../swipeableRowGesture';

describe('resolveSwipeRelease (deterministic from startX + dx + velocity)', () => {
  const openX = -156; // two 78px actions

  it('opens when dragged past halfway with low velocity', () => {
    expect(resolveSwipeRelease({ startX: -8, dx: -100, velocityX: 0, openX })).toBe('open');
  });

  it('closes when dragged only a short distance with low velocity', () => {
    expect(resolveSwipeRelease({ startX: -8, dx: -30, velocityX: 0, openX })).toBe('closed');
  });

  it('opens on a left fling even when the drag was short', () => {
    expect(resolveSwipeRelease({ startX: -8, dx: -20, velocityX: -1, openX })).toBe('open');
  });

  it('closes on a right fling', () => {
    expect(resolveSwipeRelease({ startX: -150, dx: 0, velocityX: 1, openX })).toBe('closed');
  });

  it('an already-open row nudged slightly stays open (no spurious close)', () => {
    expect(resolveSwipeRelease({ startX: -156, dx: 5, velocityX: 0, openX })).toBe('open');
  });
});

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
