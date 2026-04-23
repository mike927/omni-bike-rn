import { StyleSheet, View, type ViewStyle } from 'react-native';

import { IconCard } from '../components/IconCard';

interface Page3StartIllustrationProps {
  readonly style?: ViewStyle;
  readonly testID?: string;
}

export function Page3StartIllustration({ style, testID }: Page3StartIllustrationProps) {
  return (
    <View style={[styles.row, style]} testID={testID}>
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
