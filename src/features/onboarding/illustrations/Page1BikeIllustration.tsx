import { StyleSheet, View, type ViewStyle } from 'react-native';

import { BluetoothConnector } from '../components/BluetoothConnector';
import { IconCard } from '../components/IconCard';

interface Page1BikeIllustrationProps {
  readonly style?: ViewStyle;
  readonly testID?: string;
}

export function Page1BikeIllustration({ style, testID }: Page1BikeIllustrationProps) {
  return (
    <View style={[styles.row, style]} testID={testID}>
      <IconCard icon="vibration" />
      <BluetoothConnector />
      <IconCard icon="directions-bike" />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
});
