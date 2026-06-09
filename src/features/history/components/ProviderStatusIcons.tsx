import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import type { ReactElement } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  APPLE_HEALTH_PROVIDER_ID,
  KNOWN_PROVIDER_DISPLAY_ORDER,
  STRAVA_PROVIDER_ID,
  type KnownProviderId,
} from '../../../services/export/providerIds';
import { noir } from '../../../ui/theme';
import type { ProviderStatusIconsProps } from './ProviderStatusIcons.types';
import { isAppleHealthSupported } from '../../../services/health/isAppleHealthSupported';

const ICON_SIZE = 18;

/**
 * Calm Noir keeps the real provider glyphs but recolours them to the app palette: synced rides
 * use the mint accent, un-synced ones the muted ink. Brand colours (e.g. Strava orange) are never used.
 */
export function providerIconColor(uploaded: boolean): string {
  return uploaded ? noir.mintSoft : noir.ink3;
}

const PROVIDER_LABELS: Record<KnownProviderId, { readonly uploaded: string; readonly missing: string }> = {
  [STRAVA_PROVIDER_ID]: { uploaded: 'Uploaded to Strava', missing: 'Not uploaded to Strava' },
  [APPLE_HEALTH_PROVIDER_ID]: { uploaded: 'Synced to Apple Health', missing: 'Not synced to Apple Health' },
};

function renderProviderIcon(providerId: KnownProviderId, uploaded: boolean): ReactElement {
  const color = providerIconColor(uploaded);
  const accessibilityLabel = uploaded ? PROVIDER_LABELS[providerId].uploaded : PROVIDER_LABELS[providerId].missing;

  switch (providerId) {
    case STRAVA_PROVIDER_ID:
      return (
        <FontAwesome5
          key={providerId}
          name="strava"
          size={ICON_SIZE}
          color={color}
          accessibilityRole="image"
          accessibilityLabel={accessibilityLabel}
        />
      );
    case APPLE_HEALTH_PROVIDER_ID:
      return (
        <Ionicons
          key={providerId}
          name="heart"
          size={ICON_SIZE}
          color={color}
          accessibilityRole="image"
          accessibilityLabel={accessibilityLabel}
        />
      );
    default: {
      const _exhaustive: never = providerId;
      return _exhaustive;
    }
  }
}

/**
 * Shows every known provider on every row (mockup `screen-06-history`): synced ones lit in mint,
 * the rest dimmed — so a glance tells you where a ride was published.
 */
export function ProviderStatusIcons({ uploadedProviderIds }: Readonly<ProviderStatusIconsProps>) {
  const uploadedSet = new Set<KnownProviderId>(uploadedProviderIds);

  return (
    <View style={styles.container}>
      {KNOWN_PROVIDER_DISPLAY_ORDER.filter(
        (providerId) => providerId !== APPLE_HEALTH_PROVIDER_ID || isAppleHealthSupported(),
      ).map((providerId) => renderProviderIcon(providerId, uploadedSet.has(providerId)))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
