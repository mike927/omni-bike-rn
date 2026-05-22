import { useState } from 'react';
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from 'react-native';

import { activeHrSourceLabel, type ActiveHrSource, type WatchHrDisplayState } from '../../../services/hr/hrStatus';
import { palette } from '../../../ui/theme';

// LayoutAnimation requires an explicit opt-in on Android (no-op on iOS).
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export interface HeartRateSourceTileProps {
  readonly activeHrSource: ActiveHrSource;
  readonly watchAvailable: boolean;
  readonly watchHrEnabled: boolean;
  readonly watchHrDisplayState: WatchHrDisplayState;
  readonly latestAppleWatchHr: number | null;
  readonly bluetoothConnected: boolean;
  readonly onEnableWatch: () => void;
  readonly onDisableWatch: () => void;
}

export function HeartRateSourceTile({ activeHrSource }: HeartRateSourceTileProps) {
  const [expanded, setExpanded] = useState(false);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((value) => !value);
  };

  return (
    <View style={styles.card}>
      <Pressable accessibilityRole="button" onPress={toggle} style={styles.header}>
        <Text style={styles.label}>Heart Rate Source</Text>
        <View style={styles.headerRight}>
          <Text style={styles.value}>{activeHrSourceLabel(activeHrSource)}</Text>
          <Text style={styles.chevron}>{expanded ? '▾' : '▸'}</Text>
        </View>
      </Pressable>

      {expanded ? (
        <View style={styles.detail}>
          <View style={styles.sourceRow}>
            <Text style={styles.sourceName}>Bluetooth HR</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surfaceMuted,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  value: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '700',
  },
  chevron: {
    color: palette.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  detail: {
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingTop: 12,
  },
  sourceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  sourceInfo: {
    flex: 1,
    gap: 2,
  },
  sourceName: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '600',
  },
  activeSource: {
    color: palette.primary,
  },
  sourceStatus: {
    color: palette.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  hint: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
});
