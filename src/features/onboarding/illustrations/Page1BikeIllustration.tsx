import { StyleSheet, View } from 'react-native';

import { BluetoothConnector } from '../components/BluetoothConnector';
import { IconCard } from '../components/IconCard';

interface Page1BikeIllustrationProps {
  readonly testID?: string;
}

export function Page1BikeIllustration({ testID }: Page1BikeIllustrationProps) {
  return (
    <View style={styles.row} testID={testID}>
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
