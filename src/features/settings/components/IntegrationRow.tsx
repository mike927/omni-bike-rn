import { StyleSheet, View, Text } from 'react-native';
import { noir } from '../../../ui/theme';

export interface IntegrationRowProps {
  readonly icon: React.ReactNode;
  readonly name: string;
  readonly statusLabel: string;
  readonly connected: boolean;
  readonly action: React.ReactNode;
  readonly brandDotColor?: string;
  readonly children?: React.ReactNode;
  readonly testID?: string;
}

export function IntegrationRow({
  icon,
  name,
  statusLabel,
  connected,
  action,
  brandDotColor,
  children,
  testID,
}: IntegrationRowProps) {
  const row = (
    <View style={styles.row}>
      <View style={styles.iconBox}>{icon}</View>
      <View style={styles.meta}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {brandDotColor ? <View style={[styles.brandDot, { backgroundColor: brandDotColor }]} /> : null}
        </View>
        <Text style={[styles.status, { color: connected ? noir.mintSoft : noir.ink3 }]}>{statusLabel}</Text>
      </View>
      <View>{action}</View>
    </View>
  );

  return (
    <View style={styles.card} testID={testID}>
      {children ? (
        <>
          {row}
          <View style={styles.hairline} />
          <View style={styles.childrenWrapper}>{children}</View>
        </>
      ) : (
        row
      )}
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
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { color: noir.ink, fontSize: 15, fontWeight: '700' },
  brandDot: { width: 7, height: 7, borderRadius: 3.5 },
  status: { fontSize: 12.5, fontWeight: '600', marginTop: 2 },
  hairline: { height: 1, backgroundColor: noir.hairline, marginTop: 14 },
  childrenWrapper: { marginTop: 14 },
});
