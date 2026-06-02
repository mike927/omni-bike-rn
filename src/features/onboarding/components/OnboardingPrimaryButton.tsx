import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { noir } from '../../../ui/theme';

interface OnboardingPrimaryButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly testID?: string;
}

const PRESS_SCALE = 0.97;
const PRESS_DURATION = 90;
const RELEASE_DURATION = 140;

export function OnboardingPrimaryButton({ label, onPress, testID }: OnboardingPrimaryButtonProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  // Press scale is driven by Pressable's onPressIn/onPressOut (not touch
  // handlers on a parent View) so the gesture lifecycle composes with the
  // ScrollView's pan responder — no stuck-pressed state on Android when a
  // horizontal swipe begins on top of the button.
  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        testID={testID}
        onPressIn={() => {
          scale.value = withTiming(PRESS_SCALE, { duration: PRESS_DURATION, easing: Easing.out(Easing.quad) });
        }}
        onPressOut={() => {
          scale.value = withTiming(1, { duration: RELEASE_DURATION, easing: Easing.out(Easing.quad) });
        }}
        onPress={onPress}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
        <Text style={styles.label}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 56,
    borderRadius: 999,
    backgroundColor: noir.indigo,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  pressed: {
    backgroundColor: noir.indigoPress,
  },
  label: {
    color: noir.ink,
    fontSize: 18,
    fontWeight: '700',
  },
});
