export interface SwipeSnapInput {
  /** Current x translation of the foreground; negative = open-ward (swiped left). */
  readonly translateX: number;
  /** Release horizontal velocity (RN gesture units); negative = moving left. */
  readonly velocityX: number;
  /** Full reveal width (sum of action widths). */
  readonly openWidth: number;
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
