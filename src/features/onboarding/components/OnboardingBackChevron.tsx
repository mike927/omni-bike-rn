import { Pressable, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { palette } from '../../../ui/theme';

interface OnboardingBackChevronProps {
  readonly visible: boolean;
  readonly onPress: () => void;
}

export function OnboardingBackChevron({ visible, onPress }: OnboardingBackChevronProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      hitSlop={8}
      onPress={onPress}
      style={[styles.button, !visible && styles.hidden]}>
      <Svg width="20" height="20" viewBox="0 0 24 24">
        <Path
          d="M15 18 L9 12 L15 6"
          fill="none"
          stroke={palette.text}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hidden: {
    opacity: 0,
  },
});
