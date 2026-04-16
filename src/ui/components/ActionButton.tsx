import { Pressable, StyleSheet, Text, type TextStyle, type ViewStyle } from 'react-native';

import { palette } from '../theme';

type ActionButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface ActionButtonProps {
  label: string;
  onPress: () => void | Promise<void>;
  variant?: ActionButtonVariant;
  disabled?: boolean;
  fullWidth?: boolean;
}

const variantStyles: Record<ActionButtonVariant, { container: ViewStyle; label: TextStyle }> = {
  primary: {
    container: {
      backgroundColor: palette.primary,
      borderColor: palette.primary,
    },
    label: {
      color: palette.surface,
    },
  },
  secondary: {
    container: {
      backgroundColor: palette.surfaceMuted,
      borderColor: palette.border,
    },
    label: {
      color: palette.text,
    },
  },
  danger: {
    container: {
      backgroundColor: '#ffe7e7',
      borderColor: '#f5b1b1',
    },
    label: {
      color: palette.danger,
    },
  },
  ghost: {
    container: {
      backgroundColor: palette.surface,
      borderColor: palette.border,
    },
    label: {
      color: palette.textMuted,
    },
  },
};

export function ActionButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  fullWidth = false,
}: Readonly<ActionButtonProps>) {
  const selectedVariant = variantStyles[variant];

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => {
        void onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        selectedVariant.container,
        fullWidth ? styles.fullWidth : styles.autoWidth,
        disabled ? styles.disabled : null,
        pressed && !disabled ? styles.pressed : null,
      ]}>
      <Text style={[styles.label, selectedVariant.label]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
  },
  autoWidth: {
    alignSelf: 'flex-start',
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.82,
  },
});
