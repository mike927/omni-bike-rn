import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { StatusPill } from '../../../ui/components/StatusPill';
import { deviceStatusLabel, type DeviceStatus } from '../../../types/deviceStatus';
import { noir } from '../../../ui/theme';

// ---------------------------------------------------------------------------
// GearCard — icon-led Calm Noir card for bike + HR-source tiles.
// Ports the in-file SettingsScreen `GearTile`, preserving every prop, testID,
// and a11y behavior; restyles to the dark theme and adds a leading icon box +
// kind sub-label, mirroring home's DeviceCard.
// ---------------------------------------------------------------------------

export interface GearCardProps {
  readonly icon: keyof typeof Ionicons.glyphMap;
  readonly name: string;
  /** Sub-label under the name; rendered as `${kind} · primary` when selected. */
  readonly kind: string;
  readonly status: DeviceStatus;
  /**
   * HR-source tiles only: show 4 px accent bar + tint when selected.
   * When `undefined` the tile is treated as an **expand-only** tile (e.g. Bike):
   * the body press toggles expand instead of selecting, and the body is
   * announced as a button with `expanded` state rather than `selected`.
   */
  readonly selected?: boolean;
  /**
   * Selectable tiles: called when the body is pressed to select this source.
   * Ignored for expand-only tiles (where `selected` is `undefined`).
   */
  readonly onSelectPress?: () => void;
  /** testID applied to the tile header TouchableOpacity */
  readonly headerTestId?: string;
  /** When true, a chevron button is shown on the right edge of the header */
  readonly expandable?: boolean;
  /** Controlled expanded state */
  readonly expanded?: boolean;
  /** Called when the chevron is pressed; for expand-only tiles also called by body press */
  readonly onToggleExpand?: () => void;
  /** testID for the chevron button */
  readonly chevronTestId?: string;
  /** Content rendered inside the tile when expanded */
  readonly actions?: React.ReactNode;
  /** Set false to hide the status pill, e.g. the not-set-up setup-affordance tile. Defaults true. */
  readonly showStatus?: boolean;
}

function GearCardChevron({
  expanded,
  onToggle,
  testID,
  name,
}: {
  readonly expanded: boolean;
  readonly onToggle?: () => void;
  readonly testID?: string;
  readonly name: string;
}) {
  return (
    <TouchableOpacity
      style={styles.chevron}
      testID={testID}
      onPress={(e) => {
        e?.stopPropagation?.();
        onToggle?.();
      }}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel={expanded ? `Collapse ${name}` : `Expand ${name}`}>
      <Ionicons
        name={expanded ? 'chevron-up' : 'chevron-down'}
        size={18}
        color={expanded ? noir.indigoSoft : noir.ink3}
      />
    </TouchableOpacity>
  );
}

export function GearCard({
  icon,
  name,
  kind,
  status,
  selected,
  onSelectPress,
  headerTestId,
  expandable = false,
  expanded = false,
  onToggleExpand,
  chevronTestId,
  actions,
  showStatus = true,
}: GearCardProps) {
  // A tile is selectable when the caller supplies a boolean `selected` prop.
  // When `selected` is undefined the tile is expand-only (e.g. the Bike tile):
  // tapping the body toggles expand and the body is announced as a button
  // with `expanded` state rather than `selected`.
  const isSelectable = selected !== undefined;
  const isSelected = selected ?? false;
  // Muted = a selectable tile that is NOT the selected source.
  const muted = selected === false;

  const bodyPressHandler = isSelectable ? onSelectPress : onToggleExpand;
  const bodyA11yState =
    bodyPressHandler === undefined ? undefined : isSelectable ? { selected: isSelected } : { expanded };

  return (
    <View style={[styles.card, isSelected && styles.cardSelected]}>
      {isSelected ? <View style={styles.accentBar} /> : null}
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.body}
          onPress={bodyPressHandler}
          testID={headerTestId}
          accessibilityRole={isSelectable ? undefined : bodyPressHandler === undefined ? undefined : 'button'}
          accessibilityState={bodyA11yState}>
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
        </TouchableOpacity>
        {showStatus ? (
          <StatusPill status={status} scheme="noir" accessibilityLabel={`${name}: ${deviceStatusLabel(status)}`} />
        ) : null}
        {expandable ? (
          <GearCardChevron expanded={expanded} onToggle={onToggleExpand} testID={chevronTestId} name={name} />
        ) : null}
      </View>
      {expanded && actions !== undefined ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: noir.card,
    borderWidth: 1,
    borderColor: noir.hairline,
    borderRadius: 20,
    overflow: 'hidden',
    flexDirection: 'column',
  },
  cardSelected: {
    borderColor: 'rgba(46,61,255,0.4)',
    backgroundColor: 'rgba(46,61,255,0.14)',
  },
  accentBar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 4,
    backgroundColor: noir.indigo,
    zIndex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  body: {
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
  nameSelected: { color: noir.indigoSoft },
  kind: { color: noir.ink3, fontSize: 12.5, marginTop: 2 },
  chevron: {
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    paddingHorizontal: 10,
    paddingBottom: 10,
    paddingTop: 4,
    gap: 8,
    flexDirection: 'column',
    alignItems: 'stretch',
  },
});
