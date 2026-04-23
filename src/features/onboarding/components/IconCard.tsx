import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { type ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { gradient, palette } from '../../../ui/theme';

type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];

interface IconCardProps {
  readonly icon: MaterialIconName;
  readonly testID?: string;
}

export function IconCard({ icon, testID }: IconCardProps) {
  return (
    <View style={styles.card} testID={testID}>
      <MaterialIcons name={icon} size={64} color={gradient.cool[1]} />
      <LinearGradient
        colors={[`${palette.primary}00`, `${palette.primary}10`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 140,
    height: 160,
    backgroundColor: '#f9fafb',
    borderColor: '#f3f4f6',
    borderWidth: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
});
