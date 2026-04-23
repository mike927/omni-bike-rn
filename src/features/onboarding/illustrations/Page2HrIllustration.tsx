import { StyleSheet, View } from 'react-native';

import { BluetoothConnector } from '../components/BluetoothConnector';
import { IconCard } from '../components/IconCard';

interface Page2HrIllustrationProps {
  readonly testID?: string;
}

export function Page2HrIllustration({ testID }: Page2HrIllustrationProps) {
  return (
    <View style={styles.row} testID={testID}>
      <IconCard icon="watch" />
      <BluetoothConnector />
      <IconCard icon="favorite" />
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
