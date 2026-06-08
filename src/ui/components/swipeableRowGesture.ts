export interface SwipeSnapInput {
  /** Current x translation of the foreground; negative = open-ward (swiped left). */
  readonly translateX: number;
  /** Release horizontal velocity (RN gesture units); negative = moving left. */
  readonly velocityX: number;
  /** Full reveal width (sum of action widths). */
  readonly openWidth: number;
}

export interface SwipeClampInput {
  /** Foreground translation when the drag began. */
  readonly startX: number;
  /** Horizontal drag delta since the gesture began (negative = left). */
  readonly dx: number;
  /** Fully-open translation (negative; = -openWidth). */
  readonly openX: number;
}

/** Clamp a live drag to the travel range `[openX, 0]` (can't over-open or close past flush). */
export function clampSwipeTranslate({ startX, dx, openX }: SwipeClampInput): number {
  return Math.min(0, Math.max(openX, startX + dx));
}

/** Velocity (RN gesture units) above which a release is treated as an intentional fling. */
const FLING = 0.5;

/**
 * Decide whether a released swipe should settle open (actions revealed) or closed.
 * A fast fling wins regardless of position; otherwise it's a position threshold at halfway.
 */
export function resolveSwipeOpen({ translateX, velocityX, openWidth }: SwipeSnapInput): boolean {
  if (velocityX <= -FLING) return true;
  if (velocityX >= FLING) return false;
  return -translateX > openWidth / 2;
}

export interface SwipeReleaseInput {
  /** Foreground translation when the drag began (closed or open offset). */
  readonly startX: number;
  /** Horizontal drag delta since the gesture began (negative = left). */
  readonly dx: number;
  /** Release horizontal velocity (negative = moving left). */
  readonly velocityX: number;
  /** Fully-open translation (negative; = -openWidth). */
  readonly openX: number;
}

/**
 * The actual on-release decision: derive the released position deterministically from the
 * gesture (`startX + dx`, clamped) rather than from a lagging Animated listener, then snap.
 * Returns the target rest state.
 */
export function resolveSwipeRelease({ startX, dx, velocityX, openX }: SwipeReleaseInput): 'open' | 'closed' {
  const released = clampSwipeTranslate({ startX, dx, openX });
  return resolveSwipeOpen({ translateX: released, velocityX, openWidth: -openX }) ? 'open' : 'closed';
}
