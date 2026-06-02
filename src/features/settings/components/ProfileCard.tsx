import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { ActionButton } from '../../../ui/components/ActionButton';
import { noir } from '../../../ui/theme';

export interface ProfileCardProps {
  readonly summary: string;
  readonly onEdit: () => void;
}

export function ProfileCard({ summary, onEdit }: ProfileCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.iconBox}>
          <Ionicons name="person" size={22} color={noir.indigoSoft} />
        </View>
        <View style={styles.meta}>
          <Text style={styles.title}>User Profile</Text>
          <Text style={styles.summary}>{summary}</Text>
          <Text style={styles.hint}>Used for calorie accuracy</Text>
        </View>
        {/* Wrap so the row's center alignment applies — the sm ActionButton sets
            alignSelf:'flex-start', which would otherwise top-align it. */}
        <View>
          <ActionButton label="Edit" onPress={onEdit} variant="secondary" scheme="noir" size="sm" />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: noir.card,
    borderWidth: 1,
    borderColor: noir.hairline,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: noir.card3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: { flex: 1, minWidth: 0 },
  title: { color: noir.ink, fontSize: 15, fontWeight: '700' },
  summary: { color: noir.ink3, fontSize: 12.5, marginTop: 2 },
  hint: { color: noir.ink3, fontSize: 11.5, marginTop: 4 },
});
