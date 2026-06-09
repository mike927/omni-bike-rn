import { useRouter } from 'expo-router';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';

import { useSavedGear } from '../../gear/hooks/useSavedGear';
import { useAutoReconnect } from '../../gear/hooks/useAutoReconnect';
import { bleDeviceStatus } from '../../../types/deviceStatus';
import { useProviderBikeLinking } from '../../integrations/hooks/useProviderBikeLinking';
import { useDeviceConnection } from '../../training/hooks/useDeviceConnection';
import { useAppleHealthConnection } from '../../integrations/hooks/useAppleHealthConnection';
import { useStravaConnection } from '../../integrations/hooks/useStravaConnection';
import { useWatchHrControls } from '../../gear/hooks/useWatchHrControls';
import { useUserProfileStore } from '../../../store/userProfileStore';
import { ActionButton } from '../../../ui/components/ActionButton';
import { AddGearTile } from '../../../ui/components/AddGearTile';
import { noir } from '../../../ui/theme';
import type { UserProfile } from '../../../types/userProfile';
import type { HrSource } from '../../../services/hr/hrSource';
import { hrSourceName, hrSourceIdleReadiness } from '../../../services/hr/hrStatus';
import { SettingsHeader } from '../components/SettingsHeader';
import { SectionLabel, Eyebrow } from '../components/SectionLabel';
import { GearCard } from '../components/GearCard';
import { SwipeableGearRow } from '../components/SwipeableGearRow';
import { ProfileCard } from '../components/ProfileCard';
import { IntegrationRow } from '../components/IntegrationRow';
import { LinkedBikeBlock } from '../components/LinkedBikeBlock';
import { isAppleHealthSupported } from '../../../services/health/isAppleHealthSupported';

const HR_ICON = { bluetooth: 'heart', watch: 'watch' } as const;
const HR_KIND = {
  bluetooth: 'Chest strap',
  watch: 'Wrist sensor',
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function summarizeProfile(profile: UserProfile): string {
  const parts: string[] = [];
  if (profile.sex !== null) parts.push(profile.sex === 'male' ? 'Male' : 'Female');
  if (profile.dateOfBirth !== null) parts.push(`DOB ${profile.dateOfBirth}`);
  if (profile.weightKg !== null) parts.push(`${Math.round(profile.weightKg)} kg`);
  if (profile.heightCm !== null) parts.push(`${Math.round(profile.heightCm)} cm`);
  if (parts.length === 0) return 'Not set';
  return parts.join(' · ');
}

// ---------------------------------------------------------------------------
// SettingsScreen
// ---------------------------------------------------------------------------

export function SettingsScreen() {
  const router = useRouter();
  const userProfile = useUserProfileStore((s) => s.profile);
  const { bikeConnected, hrConnected, watchAvailability } = useDeviceConnection();
  const { bikeReconnectState, hrReconnectState, retryBike, retryHr } = useAutoReconnect();
  const { effectivePrimary, setPrimary, availableSources } = useWatchHrControls();
  const { savedBike, savedHrSource, forgetBike, forgetHr } = useSavedGear();
  const {
    isConnected: stravaConnected,
    athleteName,
    isLoading: stravaLoading,
    connect,
    disconnect,
  } = useStravaConnection();
  const {
    isConnected: appleHealthConnected,
    isLoading: appleHealthLoading,
    connect: connectAppleHealth,
    disconnect: disconnectAppleHealth,
  } = useAppleHealthConnection();
  const {
    currentLink,
    status: providerBikeStatus,
    needsReconnect: providerBikeNeedsReconnect,
    errorMessage: providerBikeErrorMessage,
    openProviderGearManagement,
  } = useProviderBikeLinking('strava', savedBike);

  const handleStravaConnect = async () => {
    const result = await connect();
    if (!result.success) {
      Alert.alert('Connection Failed', result.errorMessage ?? 'Could not connect to Strava.');
      return;
    }

    if (savedBike) {
      router.push('/provider-gear-link?provider=strava');
    }
  };

  const handleStravaDisconnect = async () => {
    Alert.alert('Disconnect Strava', 'Remove your Strava connection? Existing uploads will not be affected.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: () => {
          void disconnect()
            .then((result) => {
              if (!result.success) {
                Alert.alert('Disconnect Failed', result.errorMessage ?? 'Could not disconnect from Strava.');
              }
            })
            .catch((error: unknown) => {
              console.error('[SettingsScreen] Disconnect failed', error);
              Alert.alert('Disconnect Failed', 'An unexpected error occurred.');
            });
        },
      },
    ]);
  };

  const handleAppleHealthConnect = async () => {
    const result = await connectAppleHealth();
    if (!result.success) {
      Alert.alert('Connection Failed', result.errorMessage ?? 'Could not connect to Apple Health.');
    }
  };

  const handleAppleHealthDisconnect = async () => {
    Alert.alert(
      'Disconnect Apple Health',
      'Remove the Apple Health connection? Your iPhone still controls write access in Settings → Privacy & Security → Health.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: () => {
            void disconnectAppleHealth()
              .then((result) => {
                if (!result.success) {
                  Alert.alert('Disconnect Failed', result.errorMessage ?? 'Could not disconnect Apple Health.');
                }
              })
              .catch((error: unknown) => {
                console.error('[SettingsScreen] Apple Health disconnect failed', error);
                Alert.alert('Disconnect Failed', 'An unexpected error occurred.');
              });
          },
        },
      ],
    );
  };

  function renderHrSources() {
    return availableSources.map((source: HrSource) => {
      const isStrap = source === 'bluetooth';
      const name = hrSourceName(source, savedHrSource?.name ?? null);
      const status = hrSourceIdleReadiness({ source, watchAvailability, hrConnected });
      const selected = effectivePrimary === source;

      // The saved Bluetooth strap is the only removable HR source — swipe it for
      // Replace/Forget, Connect inline. The Apple Watch source is a selection-only
      // plain card.
      if (isStrap) {
        return (
          <SwipeableGearRow
            key={source}
            icon={HR_ICON[source]}
            name={name}
            kind={HR_KIND[source]}
            status={status}
            selected={selected}
            onSelectPress={() => void setPrimary(source)}
            bodyTestId={`hr-tile-${source}`}
            connect={
              savedHrSource !== null && !hrConnected
                ? {
                    label: hrReconnectState === 'connecting' ? 'Connecting...' : 'Connect',
                    onPress: () => {
                      retryHr();
                    },
                    disabled: hrReconnectState === 'connecting',
                  }
                : null
            }
            onReplace={() => router.push('/gear-setup?target=hr')}
            onForget={() => void forgetHr()}
          />
        );
      }

      return (
        <GearCard
          key={source}
          icon={HR_ICON[source]}
          name={name}
          kind={HR_KIND[source]}
          status={status}
          selected={selected}
          onSelectPress={() => void setPrimary(source)}
          headerTestId={`hr-tile-${source}`}
        />
      );
    });
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SettingsHeader title="Settings" subtitle="Manage your saved gear and active connections." />

        <SectionLabel title="My Gear" />

        <Eyebrow>Smart Bike</Eyebrow>
        {savedBike ? (
          <SwipeableGearRow
            icon="bicycle"
            name={savedBike.name}
            kind="Smart trainer"
            status={bleDeviceStatus({
              hasSavedDevice: true,
              connected: bikeConnected,
              reconnect: bikeReconnectState,
            })}
            bodyTestId="bike-tile-header"
            connect={
              bikeConnected
                ? null
                : {
                    label: bikeReconnectState === 'connecting' ? 'Connecting...' : 'Connect',
                    onPress: () => {
                      retryBike();
                    },
                    disabled: bikeReconnectState === 'connecting',
                  }
            }
            onReplace={() => router.push('/gear-setup?target=bike')}
            onForget={() => void forgetBike()}
          />
        ) : (
          <AddGearTile
            scheme="noir"
            label="Set Up Smart Bike"
            onPress={() => router.push('/gear-setup?target=bike')}
            testID="bike-setup-cta"
          />
        )}

        <Eyebrow>Heart Rate Source</Eyebrow>
        <View style={styles.gearList}>{renderHrSources()}</View>
        {savedHrSource === null ? (
          <ActionButton
            label="Add Bluetooth HR"
            onPress={() => router.push('/gear-setup?target=hr')}
            variant="secondary"
            scheme="noir"
            fullWidth
          />
        ) : null}

        <View style={styles.divider} />

        <SectionLabel title="Personal" />
        <ProfileCard summary={summarizeProfile(userProfile)} onEdit={() => router.push('/user-profile')} />

        <SectionLabel title="Integrations" />
        <IntegrationsSection
          stravaConnected={stravaConnected}
          stravaLoading={stravaLoading}
          athleteName={athleteName}
          onStravaConnect={() => void handleStravaConnect()}
          onStravaDisconnect={() => void handleStravaDisconnect()}
          savedBikeName={savedBike?.name ?? null}
          currentLink={
            currentLink ? { providerGearName: currentLink.providerGearName, stale: currentLink.stale } : null
          }
          providerBikeStatus={providerBikeStatus}
          providerBikeNeedsReconnect={providerBikeNeedsReconnect}
          providerBikeErrorMessage={providerBikeErrorMessage}
          onLinkBike={() => router.push('/provider-gear-link?provider=strava')}
          onOpenProviderGear={() => void openProviderGearManagement()}
          appleHealthConnected={appleHealthConnected}
          appleHealthLoading={appleHealthLoading}
          onAppleHealthConnect={() => void handleAppleHealthConnect()}
          onAppleHealthDisconnect={() => void handleAppleHealthDisconnect()}
          appleHealthSupported={isAppleHealthSupported()}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// IntegrationsSection — Strava + Apple Health rows
// ---------------------------------------------------------------------------

interface IntegrationsSectionProps {
  readonly stravaConnected: boolean;
  readonly stravaLoading: boolean;
  readonly athleteName: string | null;
  readonly onStravaConnect: () => void;
  readonly onStravaDisconnect: () => void;
  readonly savedBikeName: string | null;
  readonly currentLink: { providerGearName: string; stale: boolean } | null;
  readonly providerBikeStatus: string;
  readonly providerBikeNeedsReconnect: boolean;
  readonly providerBikeErrorMessage: string | null;
  readonly onLinkBike: () => void;
  readonly onOpenProviderGear: () => void;
  readonly appleHealthConnected: boolean;
  readonly appleHealthLoading: boolean;
  readonly onAppleHealthConnect: () => void;
  readonly onAppleHealthDisconnect: () => void;
  readonly appleHealthSupported: boolean;
}

function IntegrationsSection({
  stravaConnected,
  stravaLoading,
  athleteName,
  onStravaConnect,
  onStravaDisconnect,
  savedBikeName,
  currentLink,
  providerBikeStatus,
  providerBikeNeedsReconnect,
  providerBikeErrorMessage,
  onLinkBike,
  onOpenProviderGear,
  appleHealthConnected,
  appleHealthLoading,
  onAppleHealthConnect,
  onAppleHealthDisconnect,
  appleHealthSupported,
}: IntegrationsSectionProps) {
  const stravaStatusLabel = stravaConnected
    ? athleteName
      ? `Connected as ${athleteName}`
      : 'Connected'
    : 'Not connected';

  const stravaAction = stravaConnected ? (
    <ActionButton
      label="Disconnect"
      variant="danger"
      scheme="noir"
      size="sm"
      disabled={stravaLoading}
      onPress={onStravaDisconnect}
    />
  ) : (
    <ActionButton
      label={stravaLoading ? 'Connecting...' : 'Connect Strava'}
      variant="secondary"
      scheme="noir"
      size="sm"
      disabled={stravaLoading}
      onPress={onStravaConnect}
    />
  );

  const appleHealthAction = appleHealthConnected ? (
    <ActionButton
      label="Disconnect"
      variant="danger"
      scheme="noir"
      size="sm"
      disabled={appleHealthLoading}
      onPress={onAppleHealthDisconnect}
    />
  ) : (
    <ActionButton
      label={appleHealthLoading ? 'Connecting...' : 'Connect Apple Health'}
      variant="secondary"
      scheme="noir"
      size="sm"
      disabled={appleHealthLoading}
      onPress={onAppleHealthConnect}
    />
  );

  return (
    <>
      <IntegrationRow
        icon={<FontAwesome5 name="strava" size={20} color="#FC4C02" />}
        name="Strava"
        brandDotColor="#fc4c02"
        connected={stravaConnected}
        statusLabel={stravaStatusLabel}
        action={stravaAction}>
        {stravaConnected ? (
          <LinkedBikeBlock
            savedBikeName={savedBikeName}
            currentLink={currentLink}
            status={providerBikeStatus}
            needsReconnect={providerBikeNeedsReconnect}
            errorMessage={providerBikeErrorMessage}
            onLink={onLinkBike}
            onOpenProviderGear={onOpenProviderGear}
          />
        ) : null}
      </IntegrationRow>

      {appleHealthSupported ? (
        <IntegrationRow
          icon={<Ionicons name="heart" size={22} color={noir.ink3} />}
          name="Apple Health"
          connected={appleHealthConnected}
          statusLabel={appleHealthConnected ? 'Connected' : 'Not connected'}
          action={appleHealthAction}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: noir.bg },
  content: { paddingHorizontal: 22, paddingTop: 4, paddingBottom: 32, gap: 12 },
  divider: { height: 1, backgroundColor: noir.hairline, marginVertical: 4 },
  gearList: { gap: 10 },
});
