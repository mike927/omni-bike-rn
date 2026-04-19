import { useRouter } from 'expo-router';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { useSavedGear } from '../../gear/hooks/useSavedGear';
import { useProviderBikeLinking } from '../../integrations/hooks/useProviderBikeLinking';
import { useDeviceConnection } from '../../training/hooks/useDeviceConnection';
import { useAppleHealthConnection } from '../../integrations/hooks/useAppleHealthConnection';
import { useStravaConnection } from '../../integrations/hooks/useStravaConnection';
import { useWatchHrControls } from '../../gear/hooks/useWatchHrControls';
import { ActionButton } from '../../../ui/components/ActionButton';
import { SectionCard } from '../../../ui/components/SectionCard';
import { AppScreen } from '../../../ui/layout/AppScreen';
import { palette } from '../../../ui/theme';
import type { WatchAvailability } from '../../../types/watch';

interface WatchHrRowProps {
  readonly watchHrEnabled: boolean;
  readonly watchAvailability: WatchAvailability;
  readonly latestAppleWatchHr: number | null;
  readonly onEnable: () => void;
  readonly onDisable: () => void;
}

const WATCH_HR_INSTALL_HINT =
  'Open the Omni Bike app on your Apple Watch. If it is not installed yet, add it from the iPhone Watch app.';

function getWatchHrStatusLabel(
  watchHrEnabled: boolean,
  watchAvailability: WatchAvailability,
  latestAppleWatchHr: number | null,
): string {
  if (!watchHrEnabled) return 'Disabled';
  if (watchAvailability === 'unavailable') return 'Unavailable';
  if (watchAvailability === 'idle') return 'Idle';
  return latestAppleWatchHr === null ? 'In Progress' : `In Progress · ${latestAppleWatchHr} bpm`;
}

function getWatchHrHint(watchHrEnabled: boolean, watchAvailability: WatchAvailability): string | null {
  if (!watchHrEnabled || watchAvailability !== 'unavailable') {
    return null;
  }

  return WATCH_HR_INSTALL_HINT;
}

function WatchHrRow({ watchHrEnabled, watchAvailability, latestAppleWatchHr, onEnable, onDisable }: WatchHrRowProps) {
  const watchHrHint = getWatchHrHint(watchHrEnabled, watchAvailability);

  return (
    <View style={styles.gearRow}>
      <View style={styles.gearInfo}>
        <Text style={styles.gearLabel}>Apple Watch HR</Text>
        <Text style={styles.gearName}>
          {getWatchHrStatusLabel(watchHrEnabled, watchAvailability, latestAppleWatchHr)}
        </Text>
        {watchHrHint ? <Text style={styles.gearHint}>{watchHrHint}</Text> : null}
      </View>
      <View style={styles.gearActions}>
        {watchHrEnabled ? (
          <ActionButton label="Disable" onPress={onDisable} variant="danger" />
        ) : (
          <ActionButton label="Enable" onPress={onEnable} variant="secondary" />
        )}
      </View>
    </View>
  );
}

// eslint-disable-next-line sonarjs/cognitive-complexity -- large screen component; refactor tracked separately
export function SettingsScreen() {
  const router = useRouter();
  const { bikeConnected, hrConnected, latestAppleWatchHr, watchAvailability, disconnectAll } = useDeviceConnection();
  const { watchAvailable, watchHrEnabled, enableWatchHr, disableWatchHr } = useWatchHrControls();
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

  const handleDisconnect = async () => {
    try {
      await disconnectAll({ suppressAutoReconnect: true });
      Alert.alert('Disconnected', 'Cleared the active bike and heart-rate connections.');
    } catch (err: unknown) {
      console.error('[SettingsScreen] Disconnect error:', err);
      Alert.alert('Disconnect Failed', err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <AppScreen title="Settings" subtitle="Manage your saved gear and active connections.">
      <SectionCard title="My Gear">
        <View style={styles.gearRow}>
          <View style={styles.gearInfo}>
            <Text style={styles.gearLabel}>Bike</Text>
            <Text style={styles.gearName}>{savedBike ? savedBike.name : 'Not set'}</Text>
          </View>
          <View style={styles.gearActions}>
            <ActionButton
              label={savedBike ? 'Replace' : 'Set Up'}
              onPress={() => router.push('/gear-setup?target=bike')}
              variant="secondary"
            />
            {savedBike ? <ActionButton label="Forget" onPress={() => void forgetBike()} variant="danger" /> : null}
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.gearRow}>
          <View style={styles.gearInfo}>
            <Text style={styles.gearLabel}>Bluetooth HR</Text>
            <Text style={styles.gearName}>{savedHrSource ? savedHrSource.name : 'Not set'}</Text>
          </View>
          <View style={styles.gearActions}>
            <ActionButton
              label={savedHrSource ? 'Replace' : 'Add Bluetooth HR'}
              onPress={() => router.push('/gear-setup?target=hr')}
              variant="secondary"
            />
            {savedHrSource ? <ActionButton label="Forget" onPress={() => void forgetHr()} variant="danger" /> : null}
          </View>
        </View>

        {watchAvailable ? (
          <>
            <View style={styles.divider} />
            <WatchHrRow
              watchHrEnabled={watchHrEnabled}
              watchAvailability={watchAvailability}
              latestAppleWatchHr={latestAppleWatchHr}
              onEnable={() => void enableWatchHr()}
              onDisable={() => void disableWatchHr()}
            />
          </>
        ) : null}

        <ActionButton
          label="Disconnect Active Gear"
          onPress={() => void handleDisconnect()}
          variant="danger"
          disabled={!bikeConnected && !hrConnected}
        />
      </SectionCard>

      <SectionCard title="Integrations">
        <View style={styles.gearRow}>
          <View style={styles.gearInfo}>
            <Text style={styles.gearLabel}>Strava</Text>
            <Text style={styles.gearName}>
              {stravaConnected && athleteName ? athleteName : stravaConnected ? 'Connected' : 'Not connected'}
            </Text>
          </View>
          <View style={styles.gearActions}>
            {stravaConnected ? (
              <ActionButton
                label="Disconnect"
                onPress={() => void handleStravaDisconnect()}
                variant="danger"
                disabled={stravaLoading}
              />
            ) : (
              <ActionButton
                label={stravaLoading ? 'Connecting...' : 'Connect Strava'}
                onPress={() => void handleStravaConnect()}
                variant="secondary"
                disabled={stravaLoading}
              />
            )}
          </View>
        </View>

        {stravaConnected ? <View style={styles.divider} /> : null}

        {stravaConnected ? (
          <View style={styles.integrationBlock}>
            <Text style={styles.gearLabel}>Linked Bike</Text>
            {savedBike ? (
              <>
                <Text style={styles.gearName}>
                  {currentLink
                    ? currentLink.stale
                      ? `Relink ${savedBike.name}`
                      : `Linked to ${currentLink.providerGearName}`
                    : providerBikeStatus === 'no_provider_gear'
                      ? 'No Strava bikes found'
                      : 'Not linked'}
                </Text>
                <Text style={styles.integrationBody}>
                  {providerBikeNeedsReconnect
                    ? 'Reconnect Strava once to grant bike-linking access.'
                    : providerBikeStatus === 'no_provider_gear'
                      ? 'Uploads can continue without gear. Create a bike in Strava if you want it attached automatically.'
                      : currentLink?.stale
                        ? 'The previously linked Strava bike is no longer available.'
                        : currentLink
                          ? 'Future Strava uploads will attach this bike automatically.'
                          : 'Pick which Strava bike should be attached to future uploads from this Omni Bike.'}
                </Text>
                <View style={styles.gearActions}>
                  <ActionButton
                    label={currentLink ? 'Relink Bike' : 'Link Bike'}
                    onPress={() => router.push('/provider-gear-link?provider=strava')}
                    variant="secondary"
                  />
                  {providerBikeStatus === 'no_provider_gear' ? (
                    <ActionButton
                      label="Open Strava Gear"
                      onPress={() => {
                        void openProviderGearManagement();
                      }}
                      variant="ghost"
                    />
                  ) : null}
                </View>
              </>
            ) : (
              <>
                <Text style={styles.gearName}>Save a bike first</Text>
                <Text style={styles.integrationBody}>
                  Set up your bike in My Gear before linking provider gear for uploads.
                </Text>
              </>
            )}
            {providerBikeErrorMessage && !providerBikeNeedsReconnect ? (
              <Text style={styles.integrationErrorText}>{providerBikeErrorMessage}</Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.divider} />

        <View style={styles.gearRow}>
          <View style={styles.gearInfo}>
            <Text style={styles.gearLabel}>Apple Health</Text>
            <Text style={styles.gearName}>{appleHealthConnected ? 'Connected' : 'Not connected'}</Text>
          </View>
          <View style={styles.gearActions}>
            {appleHealthConnected ? (
              <ActionButton
                label="Disconnect"
                onPress={() => void handleAppleHealthDisconnect()}
                variant="danger"
                disabled={appleHealthLoading}
              />
            ) : (
              <ActionButton
                label={appleHealthLoading ? 'Connecting...' : 'Connect Apple Health'}
                onPress={() => void handleAppleHealthConnect()}
                variant="secondary"
                disabled={appleHealthLoading}
              />
            )}
          </View>
        </View>
      </SectionCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  gearRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  gearInfo: {
    flex: 1,
    gap: 2,
  },
  gearLabel: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  gearName: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '600',
  },
  gearHint: {
    marginTop: 4,
    color: palette.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  gearActions: {
    flexDirection: 'row',
    gap: 8,
  },
  divider: {
    height: 1,
    backgroundColor: palette.border,
  },
  integrationBlock: {
    gap: 8,
  },
  integrationBody: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  integrationErrorText: {
    color: palette.danger,
    fontSize: 13,
    lineHeight: 18,
  },
});
