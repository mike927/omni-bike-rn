import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { noir } from '../../../ui/theme';

export interface LinkedBikeBlockProps {
  readonly savedBikeName: string | null;
  readonly currentLink: { providerGearName: string; stale: boolean } | null;
  readonly status: string;
  readonly needsReconnect: boolean;
  readonly errorMessage: string | null;
  readonly onLink: () => void;
  readonly onOpenProviderGear: () => void;
}

function resolveTitleText(
  savedBikeName: string,
  currentLink: { providerGearName: string; stale: boolean } | null,
  status: string,
): string {
  if (currentLink) {
    return currentLink.stale ? `Relink ${savedBikeName}` : `Linked to ${currentLink.providerGearName}`;
  }
  if (status === 'no_provider_gear') return 'No Strava bikes found';
  return 'Not linked';
}

function resolveBodyText(
  currentLink: { providerGearName: string; stale: boolean } | null,
  status: string,
  needsReconnect: boolean,
): string {
  if (needsReconnect) return 'Reconnect Strava once to grant bike-linking access.';
  if (status === 'no_provider_gear')
    return 'Uploads can continue without gear. Create a bike in Strava if you want it attached automatically.';
  if (currentLink?.stale) return 'The previously linked Strava bike is no longer available.';
  if (currentLink) return 'Future Strava uploads will attach this bike automatically.';
  return 'Pick which Strava bike should be attached to future uploads from this Omni Bike.';
}

export function LinkedBikeBlock({
  savedBikeName,
  currentLink,
  status,
  needsReconnect,
  errorMessage,
  onLink,
  onOpenProviderGear,
}: LinkedBikeBlockProps) {
  const titleText = savedBikeName ? resolveTitleText(savedBikeName, currentLink, status) : 'Save a bike first';

  const bodyText = savedBikeName
    ? resolveBodyText(currentLink, status, needsReconnect)
    : 'Set up your bike in My Gear before linking provider gear for uploads.';

  return (
    <View style={styles.container}>
      <View style={styles.meta}>
        <Text style={styles.eyebrow}>Linked Strava bike</Text>
        <Text style={styles.title}>{titleText}</Text>
        <Text style={styles.body}>{bodyText}</Text>
        {savedBikeName && status === 'no_provider_gear' ? (
          <Text style={styles.link} accessibilityRole="button" onPress={onOpenProviderGear}>
            Open Strava Gear
          </Text>
        ) : null}
        {errorMessage && !needsReconnect ? <Text style={styles.error}>{errorMessage}</Text> : null}
      </View>
      {/* The relink/link action is a trailing gear icon, sharing the column the gear-card
          chevrons sit in. */}
      {savedBikeName ? (
        <TouchableOpacity
          style={styles.gearButton}
          onPress={onLink}
          accessibilityRole="button"
          accessibilityLabel={currentLink ? 'Relink Strava bike' : 'Link Strava bike'}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="settings-outline" size={20} color={noir.indigoSoft} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  meta: { flex: 1, gap: 6 },
  eyebrow: {
    color: noir.ink3,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: { color: noir.ink, fontSize: 14, fontWeight: '700' },
  body: { color: noir.ink2, fontSize: 13, lineHeight: 19 },
  link: { color: noir.indigoText, fontSize: 13, fontWeight: '700' },
  error: { color: noir.dangerSoft, fontSize: 13 },
  gearButton: { width: 22, alignItems: 'center', justifyContent: 'center' },
});
