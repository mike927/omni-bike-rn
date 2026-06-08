import type { Ionicons } from '@expo/vector-icons';

/** One management action revealed behind a {@link SwipeableRow}. */
export interface SwipeAction {
  /** Stable identifier (used as React key). */
  readonly key: string;
  /** Visible + accessibility label, e.g. "Forget". */
  readonly label: string;
  /** Ionicons glyph shown above the label. */
  readonly icon: keyof typeof Ionicons.glyphMap;
  /** `danger` = destructive (red). Defaults to neutral (indigo). */
  readonly tone?: 'neutral' | 'danger';
  /** Invoked when the action button (or its assistive-tech equivalent) is pressed. */
  readonly onPress: () => void;
}
