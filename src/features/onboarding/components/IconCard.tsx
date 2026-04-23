import { MaterialIcons } from '@expo/vector-icons';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { type ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { gradient, palette } from '../../../ui/theme';

type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];

interface IconCardProps {
  readonly icon: MaterialIconName;
  readonly testID?: string;
}

const ICON_SIZE = 64;

export function IconCard({ icon, testID }: IconCardProps) {
  return (
    <View style={styles.card} testID={testID}>
      <MaskedView
        style={styles.iconMask}
        maskElement={
          <View style={styles.maskWrapper}>
            <MaterialIcons name={icon} size={ICON_SIZE} color="#000" style={styles.iconGlyph} />
          </View>
        }>
        <LinearGradient
          colors={[...gradient.cool]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.iconGradient}
        />
      </MaskedView>
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
  iconMask: {
    width: ICON_SIZE,
    height: ICON_SIZE,
  },
  maskWrapper: {
    flex: 1,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlyph: {
    lineHeight: ICON_SIZE,
    height: ICON_SIZE,
    textAlignVertical: 'center',
    includeFontPadding: false,
    // MaterialIcons glyphs sit below their em-box center; translate up
    // (transforms don't affect layout, so the mask still aligns).
    transform: [{ translateY: -10 }],
  },
  iconGradient: {
    flex: 1,
  },
});
