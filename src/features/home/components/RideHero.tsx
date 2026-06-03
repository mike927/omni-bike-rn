import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { noir, noirGradient } from '../../../ui/theme';

export interface RideHeroProps {
  readonly kicker: string;
  readonly title: string;
  readonly subline: string;
  readonly variant: 'primary' | 'setup';
  readonly disabled?: boolean;
  readonly onPress: () => void;
  readonly testID?: string;
}

export function RideHero({ kicker, title, subline, variant, disabled = false, onPress, testID }: RideHeroProps) {
  const isSetup = variant === 'setup';
  const body = (
    <View style={styles.row}>
      <View style={styles.textCol}>
        <Text style={[styles.kicker, isSetup && styles.kickerSetup]}>{kicker.toUpperCase()}</Text>
        <Text style={[styles.title, isSetup && styles.titleSetup]}>{title}</Text>
        <Text style={[styles.subline, isSetup && styles.sublineSetup]} numberOfLines={1}>
          {subline}
        </Text>
      </View>
      <View style={[styles.goCircle, isSetup && styles.goCircleSetup]}>
        <Ionicons name={isSetup ? 'add' : 'chevron-forward'} size={22} color={isSetup ? noir.indigoSoft : '#ffffff'} />
      </View>
    </View>
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={title}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.pressable, disabled && styles.disabled, pressed && !disabled && styles.pressed]}>
      {isSetup ? (
        <View style={styles.setupCard}>{body}</View>
      ) : (
        <LinearGradient colors={noirGradient.cta} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradient}>
          {body}
        </LinearGradient>
      )}
    </Pressable>
  );
}

const RADIUS = 26;

const styles = StyleSheet.create({
  pressable: { borderRadius: RADIUS },
  pressed: { transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.55 },
  gradient: { borderRadius: RADIUS, paddingVertical: 22, paddingHorizontal: 24 },
  setupCard: {
    borderRadius: RADIUS,
    paddingVertical: 22,
    paddingHorizontal: 24,
    backgroundColor: noir.card,
    borderWidth: 1,
    borderColor: '#2a323f',
    borderStyle: 'dashed',
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  textCol: { flex: 1, minWidth: 0 },
  kicker: { color: 'rgba(255,255,255,0.78)', fontSize: 13, fontWeight: '600', letterSpacing: 0.4 },
  kickerSetup: { color: noir.indigoSoft },
  title: { color: '#ffffff', fontSize: 25, fontWeight: '800', letterSpacing: -0.5, marginTop: 4 },
  titleSetup: { color: noir.ink },
  subline: { color: 'rgba(255,255,255,0.82)', fontSize: 13.5, marginTop: 5 },
  sublineSetup: { color: noir.ink2 },
  goCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  goCircleSetup: { backgroundColor: 'rgba(86,99,255,0.14)' },
});
