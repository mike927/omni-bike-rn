import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import type { ReactElement } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  APPLE_HEALTH_PROVIDER_ID,
  KNOWN_PROVIDER_DISPLAY_ORDER,
  STRAVA_PROVIDER_ID,
  type KnownProviderId,
} from '../../../services/export/providerIds';
import { palette } from '../../../ui/theme';
import type { ProviderStatusIconsProps } from './ProviderStatusIcons.types';

const STRAVA_BRAND_ORANGE = '#FC4C02';
const ICON_SIZE = 18;

function renderProviderIcon(providerId: KnownProviderId): ReactElement {
  switch (providerId) {
    case STRAVA_PROVIDER_ID:
      return (
        <FontAwesome5
          key={providerId}
          name="strava"
          size={ICON_SIZE}
          color={STRAVA_BRAND_ORANGE}
          accessibilityRole="image"
          accessibilityLabel="Exported to Strava"
        />
      );
    case APPLE_HEALTH_PROVIDER_ID:
      return (
        <Ionicons
          key={providerId}
          name="heart"
          size={ICON_SIZE}
          color={palette.danger}
          accessibilityRole="image"
          accessibilityLabel="Exported to Apple Health"
        />
      );
    default: {
      const _exhaustive: never = providerId;
      return _exhaustive;
    }
  }
}

export function ProviderStatusIcons({ uploadedProviderIds }: Readonly<ProviderStatusIconsProps>) {
  const uploadedSet = new Set<KnownProviderId>(uploadedProviderIds);
  const iconsInOrder = KNOWN_PROVIDER_DISPLAY_ORDER.filter((providerId) => uploadedSet.has(providerId));

  if (iconsInOrder.length === 0) {
    return null;
  }

  return <View style={styles.container}>{iconsInOrder.map(renderProviderIcon)}</View>;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
