import { useRouter } from 'expo-router';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { useProviderBikeLinking } from '../hooks/useProviderBikeLinking';
import { useSavedGear } from '../../gear/hooks/useSavedGear';
import { ActionButton } from '../../../ui/components/ActionButton';
import { SectionCard } from '../../../ui/components/SectionCard';
import { AppScreen } from '../../../ui/layout/AppScreen';
import { palette } from '../../../ui/theme';

const SETTINGS_ROUTE = '/(tabs)/settings';

interface ProviderGearLinkScreenProps {
  providerId: string;
}

export function ProviderGearLinkScreen({ providerId }: ProviderGearLinkScreenProps) {
  const router = useRouter();
  const { savedBike } = useSavedGear();
  const {
    currentLink,
    availableGear,
    selectedGearId,
    potentialMatches,
    status,
    isLoading,
    isSaving,
    needsReconnect,
    errorMessage,
    selectGear,
    confirmSelection,
    clearLink,
    openProviderGearManagement,
  } = useProviderBikeLinking(providerId, savedBike);

  const potentialMatchIds = new Set(potentialMatches.map((gear) => gear.id));

  const handleConfirm = async () => {
    if (!selectedGearId) {
      Alert.alert('Link Failed', 'Choose a provider bike to link before continuing.');
      return;
    }

    const success = await confirmSelection();

    if (!success) {
      Alert.alert('Link Failed', 'Could not save the provider bike link. Please try again.');
      return;
    }

    router.replace(SETTINGS_ROUTE);
  };

  const handleClear = async () => {
    const success = await clearLink();

    if (!success) {
      Alert.alert('Unlink Failed', 'Could not remove the provider bike link. Please try again.');
      return;
    }

    router.replace(SETTINGS_ROUTE);
  };

  if (!savedBike) {
    return (
      <AppScreen title="Link Provider Bike" subtitle="Save a bike in Omni Bike before linking provider gear.">
        <SectionCard title="Bike Required">
          <Text style={styles.bodyText}>
            Set up your bike in My Gear first, then come back here to link it to the provider bike used for uploads.
          </Text>
          <ActionButton label="Back to Settings" onPress={() => router.replace(SETTINGS_ROUTE)} />
        </SectionCard>
      </AppScreen>
    );
  }

  return (
    <AppScreen
      title="Link Provider Bike"
      subtitle={`Attach a provider bike to "${savedBike.name}" for future uploads.`}>
      <SectionCard title="Your Omni Bike">
        <Text style={styles.localBikeName}>{savedBike.name}</Text>
        {currentLink ? (
          <Text style={styles.bodyText}>
            {currentLink.stale
              ? `Previously linked to ${currentLink.providerGearName}, but that bike is no longer available.`
              : `Currently linked to ${currentLink.providerGearName}.`}
          </Text>
        ) : (
          <Text style={styles.bodyText}>No provider bike linked yet.</Text>
        )}
      </SectionCard>

      {needsReconnect ? (
        <SectionCard title="Reconnect Required">
          <Text style={styles.bodyText}>
            Reconnect Strava once to grant bike-list access, then return here to finish linking.
          </Text>
          <ActionButton label="Back to Settings" onPress={() => router.replace(SETTINGS_ROUTE)} />
        </SectionCard>
      ) : null}

      {!needsReconnect && status === 'no_provider_gear' && !isLoading ? (
        <SectionCard title="No Provider Bikes Found">
          <Text style={styles.bodyText}>
            No bikes are defined in your provider account yet. Uploads can continue without gear, and you can create a
            bike in Strava anytime.
          </Text>
          <View style={styles.actionRow}>
            <ActionButton
              label="Open Strava Gear"
              onPress={() => void openProviderGearManagement()}
              variant="secondary"
            />
            <ActionButton label="Skip for Now" onPress={() => router.replace(SETTINGS_ROUTE)} variant="ghost" />
          </View>
        </SectionCard>
      ) : null}

      {!needsReconnect && availableGear.length > 0 ? (
        <SectionCard title="Available Provider Bikes">
          {potentialMatches.length > 0 ? (
            <Text style={styles.bodyText}>
              Possible matches for {savedBike.name} are labeled below. You can still choose any provider bike.
            </Text>
          ) : null}
          {availableGear.map((gear) => {
            const isSelected = selectedGearId === gear.id;
            const isPotentialMatch = potentialMatchIds.has(gear.id);

            return (
              <View key={gear.id} style={[styles.gearRow, isSelected ? styles.gearRowSelected : null]}>
                <View style={styles.gearInfo}>
                  <Text style={styles.gearName}>{gear.name}</Text>
                  <Text style={styles.gearMeta}>
                    {isPotentialMatch && gear.isPrimary
                      ? 'Possible match · Primary bike in provider account'
                      : isPotentialMatch
                        ? 'Possible match'
                        : gear.isPrimary
                          ? 'Primary bike in provider account'
                          : 'Provider bike'}
                  </Text>
                </View>
                <ActionButton
                  label={isSelected ? 'Selected' : 'Choose'}
                  onPress={() => selectGear(gear.id)}
                  variant={isSelected ? 'primary' : 'secondary'}
                />
              </View>
            );
          })}
        </SectionCard>
      ) : null}

      {errorMessage && !needsReconnect ? (
        <SectionCard title="Unable to Load Provider Bikes">
          <Text style={styles.bodyText}>{errorMessage}</Text>
          <ActionButton label="Back to Settings" onPress={() => router.replace(SETTINGS_ROUTE)} />
        </SectionCard>
      ) : null}

      {!needsReconnect ? (
        <View style={styles.actionRow}>
          <ActionButton
            label={isLoading || isSaving ? 'Working...' : 'Link Bike'}
            onPress={() => {
              void handleConfirm();
            }}
            disabled={isLoading || isSaving || !selectedGearId}
          />
          <ActionButton label="Skip for Now" onPress={() => router.replace(SETTINGS_ROUTE)} variant="ghost" />
          {currentLink ? (
            <ActionButton
              label="Unlink"
              onPress={() => {
                void handleClear();
              }}
              variant="danger"
            />
          ) : null}
        </View>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  bodyText: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 22,
  },
  localBikeName: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '700',
  },
  gearRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surfaceMuted,
    padding: 14,
  },
  gearRowSelected: {
    borderColor: palette.primary,
    backgroundColor: '#dbeafe',
  },
  gearInfo: {
    flex: 1,
    gap: 4,
  },
  gearName: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '700',
  },
  gearMeta: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
});
