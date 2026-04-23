import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { gradient, palette } from '../../../ui/theme';

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
        onPress={onPress}>
        <LinearGradient colors={[...gradient.cool]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.button}>
          <Text style={styles.label}>{label}</Text>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 56,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  label: {
    color: palette.surface,
    fontSize: 18,
    fontWeight: '700',
  },
});
