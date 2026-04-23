import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { gradient, palette } from '../../../ui/theme';

interface OnboardingProgressBarProps {
  readonly total: number;
  readonly scrollX: SharedValue<number>;
  readonly pageWidth: number;
}

export function OnboardingProgressBar({ total, scrollX, pageWidth }: OnboardingProgressBarProps) {
  return (
    <View style={styles.row}>
      {Array.from({ length: total }).map((_, index) => (
        <ProgressPill key={index} index={index} scrollX={scrollX} pageWidth={pageWidth} />
      ))}
    </View>
  );
}

interface ProgressPillProps {
  readonly index: number;
  readonly scrollX: SharedValue<number>;
  readonly pageWidth: number;
}

function ProgressPill({ index, scrollX, pageWidth }: ProgressPillProps) {
  const fillStyle = useAnimatedStyle(() => {
    const distance = pageWidth > 0 ? Math.abs(scrollX.value / pageWidth - index) : 0;
    return { opacity: interpolate(distance, [0, 1], [1, 0], 'clamp') };
  });

  return (
    <View style={styles.pill}>
      <Animated.View style={[StyleSheet.absoluteFill, fillStyle]}>
        <LinearGradient
          colors={[...gradient.cool]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    flex: 1,
    height: 6,
  },
  pill: {
    flex: 1,
    height: 6,
    borderRadius: 999,
    backgroundColor: palette.border,
    overflow: 'hidden',
  },
});
