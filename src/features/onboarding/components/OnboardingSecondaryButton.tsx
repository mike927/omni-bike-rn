import { Pressable, StyleSheet, Text } from 'react-native';

import { palette } from '../../../ui/theme';

interface OnboardingSecondaryButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly testID?: string;
}

export function OnboardingSecondaryButton({ label, onPress, testID }: OnboardingSecondaryButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
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
  pressed: {
    opacity: 0.6,
  },
  label: {
    color: palette.textMuted,
    fontSize: 16,
    fontWeight: '600',
  },
});
