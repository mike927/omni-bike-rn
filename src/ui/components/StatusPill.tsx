import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import {
  deviceStatusLabel,
  deviceStatusTone,
  type DeviceStatus,
  type DeviceStatusTone,
} from '../../services/status/deviceStatus';
import { palette } from '../theme';

interface ToneColors {
  readonly bg: string;
  readonly fg: string;
  readonly dot: string;
}

// Background = tone color @ ~16% alpha (inactive uses the palette's pill fill); text = darkened tone ink; dot = solid tone color.
const TONE_COLORS: Record<DeviceStatusTone, ToneColors> = {
  good: { bg: 'rgba(16, 181, 164, 0.16)', fg: palette.successInk, dot: palette.success },
  working: { bg: 'rgba(245, 165, 36, 0.18)', fg: palette.warningInk, dot: palette.warning },
  attention: { bg: 'rgba(239, 75, 92, 0.14)', fg: palette.dangerInk, dot: palette.danger },
  inactive: { bg: palette.surfaceMuted, fg: palette.tabInactive, dot: palette.tabInactive },
};

export interface StatusPillProps {
  readonly status: DeviceStatus;
  readonly accessibilityLabel?: string;
  readonly testID?: string;
}

export function StatusPill({ status, accessibilityLabel, testID }: StatusPillProps) {
  const tone = deviceStatusTone(status);
  const colors = TONE_COLORS[tone];
  const label = deviceStatusLabel(status);

  const opacity = useSharedValue(1);
  useEffect(() => {
    if (status === 'connecting') {
      opacity.value = withRepeat(withTiming(0.3, { duration: 650, easing: Easing.inOut(Easing.quad) }), -1, true);
      return () => cancelAnimation(opacity);
    }
    opacity.value = 1;
    return undefined;
  }, [status, opacity]);

  const dotStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View
      style={[styles.pill, { backgroundColor: colors.bg }]}
      testID={testID}
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? label}>
      <Animated.View
        style={[styles.dot, { backgroundColor: colors.dot }, dotStyle]}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <Text style={[styles.label, { color: colors.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 999,
    flexShrink: 0,
  },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  label: { fontSize: 12, fontWeight: '700' },
});
