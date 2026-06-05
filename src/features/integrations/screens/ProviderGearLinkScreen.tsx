import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useProviderBikeLinking } from '../hooks/useProviderBikeLinking';
import { useSavedGear } from '../../gear/hooks/useSavedGear';
import { ActionButton } from '../../../ui/components/ActionButton';
import { noir } from '../../../ui/theme';
import { AvailableProviderBikeList } from '../components/AvailableProviderBikeList';

const SETTINGS_ROUTE = '/(tabs)/settings';
const PROVIDER_LABELS: Readonly<Record<string, string>> = { strava: 'Strava' };

/** Human provider name for the garage chip — identity only, no connection claim. */
function providerDisplayName(providerId: string): string {
  return PROVIDER_LABELS[providerId] ?? providerId.charAt(0).toUpperCase() + providerId.slice(1);
}

interface ProviderGearLinkScreenProps {
  providerId: string;
}

export function ProviderGearLinkScreen({ providerId }: Readonly<ProviderGearLinkScreenProps>) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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

  const header = (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={10}
        onPress={() => router.back()}
        style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}>
        <Ionicons name="chevron-back" size={22} color={noir.ink2} />
      </Pressable>
      <Text style={styles.headerTitle}>Link Provider Bike</Text>
      <View style={styles.headerSpacer} />
    </View>
  );

  if (!savedBike) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        {header}
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.intro}>Save a bike in Omni Bike before linking provider gear.</Text>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Bike Required</Text>
            <Text style={styles.bodyText}>
              Set up your bike in My Gear first, then come back here to link it to the provider bike used for uploads.
            </Text>
            <ActionButton
              scheme="noir"
              variant="secondary"
              fullWidth
              label="Back to Settings"
              onPress={() => router.replace(SETTINGS_ROUTE)}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const showList = !needsReconnect && availableGear.length > 0;
  const showLoading = isLoading && !needsReconnect && availableGear.length === 0;
  const showNoGear = !needsReconnect && status === 'no_provider_gear' && !isLoading && !errorMessage;
  const showError = Boolean(errorMessage) && !needsReconnect;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      {header}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>Attach a provider bike to &quot;{savedBike.name}&quot; for future uploads.</Text>

        <View style={styles.garageHeader}>
          <View style={styles.providerChip}>
            <Ionicons name="link" size={13} color={noir.mintSoft} />
            <Text style={styles.providerChipLabel}>{providerDisplayName(providerId)}</Text>
          </View>
          <Text style={styles.contextLine}>
            Linking to · <Text style={styles.contextLineEmphasis}>{savedBike.name}</Text>
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Your Omni Bike</Text>
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
        </View>

        {needsReconnect ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Reconnect Required</Text>
            <Text style={styles.bodyText}>
              Reconnect Strava once to grant bike-list access, then return here to finish linking.
            </Text>
            <ActionButton
              scheme="noir"
              variant="secondary"
              fullWidth
              label="Back to Settings"
              onPress={() => router.replace(SETTINGS_ROUTE)}
            />
          </View>
        ) : null}

        {showLoading ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Loading Provider Bikes</Text>
            <ActivityIndicator color={noir.indigoSoft} />
          </View>
        ) : null}

        {showNoGear ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>No Provider Bikes Found</Text>
            <Text style={styles.bodyText}>
              No bikes are defined in your provider account yet. Uploads can continue without gear, and you can create a
              bike in Strava anytime.
            </Text>
            <View style={styles.cardActionRow}>
              <View style={styles.cardActionBtn}>
                <ActionButton
                  scheme="noir"
                  variant="secondary"
                  fullWidth
                  label="Open Strava Gear"
                  onPress={() => void openProviderGearManagement()}
                />
              </View>
              <View style={styles.cardActionBtn}>
                <ActionButton
                  scheme="noir"
                  variant="ghost"
                  fullWidth
                  label="Skip for Now"
                  onPress={() => router.replace(SETTINGS_ROUTE)}
                />
              </View>
            </View>
          </View>
        ) : null}

        {showList ? (
          <AvailableProviderBikeList
            savedBikeName={savedBike.name}
            availableGear={availableGear}
            potentialMatchIds={potentialMatchIds}
            selectedGearId={selectedGearId}
            hasPotentialMatches={potentialMatches.length > 0}
            onSelect={selectGear}
          />
        ) : null}

        {showError ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Unable to Load Provider Bikes</Text>
            <Text style={styles.bodyText}>{errorMessage}</Text>
            <ActionButton
              scheme="noir"
              variant="secondary"
              fullWidth
              label="Back to Settings"
              onPress={() => router.replace(SETTINGS_ROUTE)}
            />
          </View>
        ) : null}

        {needsReconnect ? null : (
          <Pressable
            accessibilityRole="button"
            onPress={() => void openProviderGearManagement()}
            style={({ pressed }) => [styles.openGearFooter, pressed && styles.openGearFooterPressed]}>
            <Ionicons name="open-outline" size={15} color={noir.ink2} />
            <Text style={styles.openGearLabel}>Don&apos;t see your bike? Open Strava Gear</Text>
          </Pressable>
        )}
      </ScrollView>

      {needsReconnect ? null : (
        <View style={[styles.actionBar, { paddingBottom: insets.bottom + 14 }]}>
          <View style={styles.actionRow}>
            {currentLink ? (
              <View style={styles.actionBtn}>
                <ActionButton
                  scheme="noir"
                  variant="danger"
                  fullWidth
                  label="Unlink"
                  onPress={() => {
                    void handleClear();
                  }}
                />
              </View>
            ) : null}
            <View style={styles.actionBtn}>
              <ActionButton
                scheme="noir"
                variant="primary"
                fullWidth
                label={isLoading || isSaving ? 'Working...' : 'Link Bike'}
                disabled={isLoading || isSaving || !selectedGearId}
                onPress={() => {
                  void handleConfirm();
                }}
              />
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace(SETTINGS_ROUTE)}
            style={({ pressed }) => [styles.skipBtn, pressed && styles.skipBtnPressed]}>
            <Text style={styles.skipLabel}>Skip for Now</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: noir.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: noir.card,
    borderWidth: 1,
    borderColor: noir.hairline,
  },
  backBtnPressed: { opacity: 0.6 },
  headerSpacer: { width: 40, height: 40 },
  headerTitle: { color: noir.ink, fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },
  content: { paddingHorizontal: 22, paddingTop: 6, paddingBottom: 24 },
  intro: { color: noir.ink2, fontSize: 14, lineHeight: 21, marginBottom: 16, marginLeft: 4 },
  garageHeader: { gap: 9, marginBottom: 16, marginLeft: 4 },
  providerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingVertical: 6,
    paddingLeft: 9,
    paddingRight: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(16,181,164,0.12)',
  },
  providerChipLabel: { color: noir.mintSoft, fontSize: 12.5, fontWeight: '700' },
  contextLine: { color: noir.ink3, fontSize: 13, fontWeight: '500' },
  contextLineEmphasis: { color: noir.ink, fontWeight: '700' },
  card: {
    backgroundColor: noir.card,
    borderWidth: 1,
    borderColor: noir.hairline,
    borderRadius: 20,
    padding: 18,
    gap: 12,
    marginBottom: 14,
  },
  cardTitle: { color: noir.ink, fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
  localBikeName: { color: noir.ink, fontSize: 18, fontWeight: '700' },
  bodyText: { color: noir.ink2, fontSize: 14, lineHeight: 22 },
  cardActionRow: { flexDirection: 'row', gap: 10 },
  cardActionBtn: { flex: 1 },
  openGearFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: noir.hairline,
  },
  openGearFooterPressed: { opacity: 0.6 },
  openGearLabel: { color: noir.ink2, fontSize: 13, fontWeight: '600' },
  actionBar: {
    paddingHorizontal: 22,
    paddingTop: 12,
    backgroundColor: noir.bg,
    borderTopWidth: 1,
    borderTopColor: noir.hairline,
  },
  actionRow: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1 },
  skipBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    marginTop: 4,
  },
  skipBtnPressed: { opacity: 0.6 },
  skipLabel: { color: noir.ink2, fontSize: 14, fontWeight: '700' },
});
