import { StyleSheet, Text, View } from 'react-native';
import { ActionButton } from '../../../ui/components/ActionButton';
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
      <Text style={styles.eyebrow}>Linked Strava bike</Text>
      <Text style={styles.title}>{titleText}</Text>
      <Text style={styles.body}>{bodyText}</Text>
      {errorMessage && !needsReconnect ? <Text style={styles.error}>{errorMessage}</Text> : null}
      {savedBikeName ? (
        <View style={styles.actions}>
          <ActionButton
            label={currentLink ? 'Relink Bike' : 'Link Bike'}
            onPress={onLink}
            variant="secondary"
            scheme="noir"
            size="sm"
          />
          {status === 'no_provider_gear' ? (
            <ActionButton
              label="Open Strava Gear"
              onPress={onOpenProviderGear}
              variant="ghost"
              scheme="noir"
              size="sm"
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  eyebrow: {
    color: noir.ink3,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: { color: noir.ink, fontSize: 14, fontWeight: '700' },
  body: { color: noir.ink2, fontSize: 13, lineHeight: 19 },
  error: { color: noir.dangerSoft, fontSize: 13 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
});
