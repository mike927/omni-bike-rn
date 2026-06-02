import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { noir, noirGradient } from '../../../ui/theme';

interface OnboardingHeroProps {
  readonly children: ReactNode;
  readonly testID?: string;
}

export function OnboardingHero({ children, testID }: OnboardingHeroProps) {
  return (
    <View style={styles.card} testID={testID}>
      <LinearGradient
        colors={[...noirGradient.hero]}
        start={{ x: 0.2, y: 0.15 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={[...noirGradient.heroGlow]}
        start={{ x: 0.8, y: 1 }}
        end={{ x: 0.3, y: 0.4 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.center}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 300,
    aspectRatio: 1,
    borderRadius: 30,
    borderCurve: 'continuous',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: noir.hairline,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
