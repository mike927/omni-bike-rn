import { Pressable, StyleSheet, Text, type TextStyle, type ViewStyle } from 'react-native';

import { noir, palette } from '../theme';

type ActionButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ActionButtonScheme = 'light' | 'noir';
type ActionButtonSize = 'md' | 'sm';

interface ActionButtonProps {
  label: string;
  onPress: () => void | Promise<void>;
  variant?: ActionButtonVariant;
  disabled?: boolean;
  fullWidth?: boolean;
  scheme?: ActionButtonScheme;
  size?: ActionButtonSize;
  /** Spoken by screen readers — use to explain *why* a button is disabled (e.g. "Connect your smart bike to start"). */
  accessibilityHint?: string;
}

const NOIR_VARIANT_STYLES: Record<ActionButtonVariant, { container: ViewStyle; label: TextStyle }> = {
  primary: {
    container: {
      backgroundColor: noir.indigo,
      borderColor: noir.indigo,
    },
    label: {
      color: '#fff',
    },
  },
  secondary: {
    container: {
      backgroundColor: noir.card3,
      borderColor: noir.hairline,
    },
    label: {
      color: noir.indigoText,
    },
  },
  danger: {
    container: {
      backgroundColor: 'rgba(239,75,92,0.12)',
      borderColor: 'rgba(239,75,92,0.28)',
    },
    label: {
      color: noir.dangerSoft,
    },
  },
  ghost: {
    container: {
      backgroundColor: 'transparent',
      borderColor: 'transparent',
    },
    label: {
      color: noir.ink2,
    },
  },
};

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
      backgroundColor: palette.dangerBg,
      borderColor: palette.dangerBorder,
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
  scheme = 'light',
  size = 'md',
  accessibilityHint,
}: Readonly<ActionButtonProps>) {
  const schemeStyles = scheme === 'noir' ? NOIR_VARIANT_STYLES : variantStyles;
  const selectedVariant = schemeStyles[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityHint={accessibilityHint}
      disabled={disabled}
      onPress={() => {
        void onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        selectedVariant.container,
        fullWidth ? styles.fullWidth : styles.autoWidth,
        size === 'sm' ? styles.buttonSm : null,
        disabled ? styles.disabled : null,
        pressed && !disabled ? styles.pressed : null,
      ]}>
      <Text style={[styles.label, selectedVariant.label, size === 'sm' ? styles.labelSm : null]}>{label}</Text>
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
  buttonSm: {
    minHeight: 44,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  labelSm: {
    fontSize: 13,
  },
});
