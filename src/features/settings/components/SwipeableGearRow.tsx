import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { deviceStatusLabel, type DeviceStatus } from '../../../types/deviceStatus';
import { StatusPill } from '../../../ui/components/StatusPill';
import { SwipeableRow } from '../../../ui/components/SwipeableRow';
import { noir } from '../../../ui/theme';

// ---------------------------------------------------------------------------
// SwipeableGearRow — a saved-gear tile whose management actions (Replace /
// Forget) live behind a left-swipe (Calm Noir "D4b"), with Connect inline.
// Used for the saved Smart Bike + saved Bluetooth strap. Non-removable sources
// (Apple Watch, bike pulse) keep the plain `GearCard`.
// ---------------------------------------------------------------------------

interface ConnectChip {
  readonly label: string;
  readonly onPress: () => void;
  readonly disabled?: boolean;
}

export interface SwipeableGearRowProps {
  readonly icon: keyof typeof Ionicons.glyphMap;
  readonly name: string;
  readonly kind: string;
  readonly status: DeviceStatus;
  /** Defined ⇒ row is selectable (tap selects); `true` adds "· primary" + accent styling. */
  readonly selected?: boolean;
  readonly onSelectPress?: () => void;
  readonly bodyTestId?: string;
  /** Inline chip shown while the device is actionable (e.g. "Connect" when disconnected). */
  readonly connect?: ConnectChip | null;
  readonly onReplace: () => void;
  readonly onForget: () => void;
}

export function SwipeableGearRow({
  icon,
  name,
  kind,
  status,
  selected,
  onSelectPress,
  bodyTestId,
  connect,
  onReplace,
  onForget,
}: SwipeableGearRowProps) {
  const isSelectable = selected !== undefined;
  const isSelected = selected ?? false;
  const muted = selected === false;

  const body = (
    <>
      <View style={[styles.iconBox, muted && styles.iconBoxMuted]}>
        <Ionicons name={icon} size={22} color={muted ? noir.ink3 : noir.indigoSoft} />
      </View>
      <View style={styles.meta}>
        <Text style={[styles.name, muted && styles.nameMuted, isSelected && styles.nameSelected]} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.kind} numberOfLines={1}>
          {isSelected ? `${kind} · primary` : kind}
        </Text>
      </View>
    </>
  );

  return (
    <SwipeableRow
      borderRadius={20}
      actions={[
        // Last entry sits at the swipe edge → indigo "Replace" peek (calm); the
        // destructive "Forget" is tucked deeper, requiring a fuller swipe.
        { key: 'forget', label: 'Forget', icon: 'trash-outline', tone: 'danger', onPress: onForget },
        { key: 'replace', label: 'Replace', icon: 'swap-horizontal-outline', onPress: onReplace },
      ]}>
      <View style={[styles.inner, isSelected && styles.innerSelected]}>
        {isSelectable ? (
          <Pressable
            style={styles.bodyPress}
            onPress={onSelectPress}
            testID={bodyTestId}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityHint="Swipe left to replace or forget this device.">
            {body}
          </Pressable>
        ) : (
          <View style={styles.bodyPress} testID={bodyTestId}>
            {body}
          </View>
        )}
        <View style={styles.trailing}>
          {connect ? (
            <Pressable
              onPress={connect.onPress}
              disabled={connect.disabled}
              accessibilityRole="button"
              accessibilityLabel={connect.label}
              style={[styles.chip, connect.disabled && styles.chipDisabled]}>
              <Text style={styles.chipLabel}>{connect.label}</Text>
            </Pressable>
          ) : (
            <StatusPill status={status} scheme="noir" accessibilityLabel={`${name}: ${deviceStatusLabel(status)}`} />
          )}
        </View>
      </View>
    </SwipeableRow>
  );
}

const styles = StyleSheet.create({
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  innerSelected: {
    backgroundColor: 'rgba(46,61,255,0.12)',
  },
  bodyPress: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    minWidth: 0,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: noir.card3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxMuted: { backgroundColor: '#1d222b' },
  meta: { flex: 1, minWidth: 0 },
  name: { color: noir.ink, fontSize: 15, fontWeight: '700', letterSpacing: -0.1 },
  nameMuted: { color: noir.ink3 },
  nameSelected: { color: noir.indigoText },
  kind: { color: noir.ink3, fontSize: 12.5, marginTop: 2 },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    backgroundColor: noir.indigo,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  chipDisabled: { opacity: 0.5 },
  chipLabel: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
