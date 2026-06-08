import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { GearType } from '../../../types/gear';
import { noir } from '../../../ui/theme';
import { BikeGlyph } from './BikeGlyph';
import { HrGlyph } from './HrGlyph';
import { NoirStatusPill } from './NoirStatusPill';

export type NearbyDeviceRowState = 'idle' | 'connecting' | 'error';

interface NearbyDeviceRowProps {
  readonly name: string | null;
  readonly deviceId: string;
  readonly target: GearType;
  readonly onSelect: () => void;
  readonly state?: NearbyDeviceRowState;
  readonly errorMessage?: string | null;
  /** Disable selection while another device's pairing is in flight. */
  readonly disabled?: boolean;
  readonly children?: ReactNode;
}

export function NearbyDeviceRow({
  name,
  deviceId,
  target,
  onSelect,
  state = 'idle',
  errorMessage,
  disabled = false,
  children,
}: NearbyDeviceRowProps) {
  const Glyph = target === 'hr' ? HrGlyph : BikeGlyph;
  const isConnecting = state === 'connecting';
  const isError = state === 'error';
  const iconColor = isError ? noir.dangerSoft : isConnecting ? noir.indigoSoft : noir.ink3;
  // The connecting row shows its own status; any other row is locked while a
  // pairing is in flight so two selections can't race on shared hook state.
  const pressDisabled = isConnecting || disabled;

  return (
    <View
      style={[
        styles.wrap,
        isConnecting && styles.wrapActive,
        isError && styles.wrapError,
        disabled && styles.wrapDisabled,
      ]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${name ?? 'Unknown Device'}, ${isError ? 'tap to retry' : isConnecting ? 'connecting' : 'tap to select'}`}
        disabled={pressDisabled}
        onPress={onSelect}
        style={styles.row}>
        <View style={styles.icon}>
          <Glyph color={iconColor} testID={target === 'hr' ? 'hr-glyph' : 'bike-glyph'} />
        </View>
        <View style={styles.meta}>
          <Text style={[styles.name, isError && styles.nameError]} numberOfLines={1}>
            {name ?? 'Unknown Device'}
          </Text>
          <Text style={styles.id} numberOfLines={1}>
            ID · {deviceId}
          </Text>
        </View>
        {isConnecting ? (
          <NoirStatusPill status="connecting" />
        ) : (
          <Text style={styles.action}>{isError ? 'Retry' : 'Select'}</Text>
        )}
      </Pressable>
      {isError && errorMessage ? <Text style={styles.errorMsg}>{errorMessage}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: noir.card,
    borderWidth: 1,
    borderColor: noir.hairline,
    borderRadius: 20,
    padding: 14,
    gap: 10,
  },
  wrapActive: { borderColor: 'rgba(46,61,255,0.4)' },
  wrapError: { borderColor: 'rgba(239,75,92,0.4)' },
  wrapDisabled: { opacity: 0.45 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#1d222b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: { flex: 1, minWidth: 0 },
  name: { fontSize: 15, fontWeight: '700', color: noir.ink },
  nameError: { color: noir.dangerSoft },
  id: { fontSize: 12.5, color: noir.ink3, marginTop: 2 },
  action: { fontSize: 13, fontWeight: '700', color: noir.indigoText, paddingHorizontal: 6 },
  errorMsg: { fontSize: 12.5, lineHeight: 18, color: noir.dangerSoft },
});
