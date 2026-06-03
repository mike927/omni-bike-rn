import { Pressable, StyleSheet, Text } from 'react-native';

import { noir } from '../../../ui/theme';

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
    borderWidth: 1,
    borderColor: noir.hairline,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  pressed: {
    opacity: 0.6,
  },
  label: {
    color: noir.ink2,
    fontSize: 16,
    fontWeight: '600',
  },
});
