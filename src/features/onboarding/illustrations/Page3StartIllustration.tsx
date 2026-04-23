import { StyleSheet, View } from 'react-native';

import { IconCard } from '../components/IconCard';

interface Page3StartIllustrationProps {
  readonly testID?: string;
}

export function Page3StartIllustration({ testID }: Page3StartIllustrationProps) {
  return (
    <View style={styles.row} testID={testID}>
      <IconCard icon="bolt" />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
