import { StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../../../ui/components/ActionButton';
import { noir } from '../../../ui/theme';

export interface DisconnectedCalloutProps {
  readonly body: string;
  readonly onSetup: () => void;
  readonly onHome: () => void;
}

export function DisconnectedCallout({ body, onSetup, onHome }: DisconnectedCalloutProps) {
  return (
    <View style={styles.callout}>
      <Text style={styles.title}>Smart Bike connection required</Text>
      <Text style={styles.body}>{body}</Text>
      <View style={styles.actions}>
        <View style={styles.half}>
          <ActionButton label="Set Up Smart Bike" onPress={onSetup} variant="secondary" scheme="noir" fullWidth />
        </View>
        <View style={styles.half}>
          <ActionButton label="Back Home" onPress={onHome} variant="ghost" scheme="noir" fullWidth />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  callout: {
    gap: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(245,165,36,0.22)',
    backgroundColor: 'rgba(245,165,36,0.08)',
    padding: 16,
  },
  title: { color: noir.ink, fontSize: 15, fontWeight: '700' },
  body: { color: noir.ink2, fontSize: 13.5, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: 11, marginTop: 2 },
  half: { flex: 1 },
});
