import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useSavedGear } from '../../gear/hooks/useSavedGear';
import { useAutoReconnect } from '../../gear/hooks/useAutoReconnect';
import { bleDeviceStatus, deviceStatusLabel, type DeviceStatus } from '../../../services/status/deviceStatus';
import { useProviderBikeLinking } from '../../integrations/hooks/useProviderBikeLinking';
import { useDeviceConnection } from '../../training/hooks/useDeviceConnection';
import { useAppleHealthConnection } from '../../integrations/hooks/useAppleHealthConnection';
import { useStravaConnection } from '../../integrations/hooks/useStravaConnection';
import { useWatchHrControls } from '../../gear/hooks/useWatchHrControls';
import { useUserProfileStore } from '../../../store/userProfileStore';
import { ActionButton } from '../../../ui/components/ActionButton';
import { SectionCard } from '../../../ui/components/SectionCard';
import { StatusPill } from '../../../ui/components/StatusPill';
import { AddGearTile } from '../../../ui/components/AddGearTile';
import { AppScreen } from '../../../ui/layout/AppScreen';
import { palette } from '../../../ui/theme';
import type { UserProfile } from '../../../types/userProfile';
import type { HrSource } from '../../../services/hr/hrSource';
import type { WatchAvailability } from '../../../types/watch';
import type { ReconnectState } from '../../../types/gear';
import { hrSourceName, hrSourceIdleReadiness } from '../../../services/hr/hrStatus';

// ---------------------------------------------------------------------------
// GearTile — shared card UI for bike + HR-source tiles
// ---------------------------------------------------------------------------

interface GearTileProps {
  readonly name: string;
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

function GearTileChevron({
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
      style={styles.gearTileChevron}
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
        color={expanded ? palette.primary : palette.textMuted}
      />
    </TouchableOpacity>
  );
}

function GearTile({
  name,
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
}: GearTileProps) {
  // A tile is selectable when the caller supplies a boolean `selected` prop.
  // When `selected` is undefined the tile is expand-only (e.g. the Bike tile):
  // tapping the body toggles expand and the body is announced as a button
  // with `expanded` state rather than `selected`.
  const isSelectable = selected !== undefined;
  const isSelected = selected ?? false;

  const bodyPressHandler = isSelectable ? onSelectPress : onToggleExpand;
  const bodyA11yState =
    bodyPressHandler === undefined ? undefined : isSelectable ? { selected: isSelected } : { expanded };

  return (
    <View style={[styles.gearTile, isSelected && styles.gearTileSelected]}>
      {isSelected ? <View style={styles.gearTileAccentBar} /> : null}
      <View style={styles.gearTileHeaderRow}>
        <TouchableOpacity
          style={styles.gearTileBody}
          onPress={bodyPressHandler}
          testID={headerTestId}
          accessibilityRole={isSelectable ? undefined : bodyPressHandler === undefined ? undefined : 'button'}
          accessibilityState={bodyA11yState}>
          <Text style={[styles.gearName, isSelected && styles.gearNameSelected]}>{name}</Text>
          {showStatus ? (
            <View style={styles.gearTileStatus}>
              <StatusPill status={status} accessibilityLabel={`${name}: ${deviceStatusLabel(status)}`} />
            </View>
          ) : null}
        </TouchableOpacity>
        {expandable ? (
          <GearTileChevron expanded={expanded} onToggle={onToggleExpand} testID={chevronTestId} name={name} />
        ) : null}
      </View>
      {expanded && actions !== undefined ? <View style={styles.gearTileActions}>{actions}</View> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// PrimaryHrSourceRow — Heart Rate Source sub-section
// ---------------------------------------------------------------------------

interface PrimaryHrSourceRowProps {
  readonly availableSources: HrSource[];
  readonly primary: HrSource | null;
  readonly watchAvailability: WatchAvailability;
  readonly savedHrSource: { name: string } | null;
  readonly hrConnected: boolean;
  readonly bikeConnected: boolean;
  readonly onSelect: (source: HrSource) => void;
  readonly hrReconnectState: ReconnectState;
  readonly onConnectHr: () => void;
  readonly onAddHr: () => void;
  readonly onReplaceHr: () => void;
  readonly onForgetHr: () => void;
  readonly hrManageOpen: boolean;
  readonly onToggleHrManage: () => void;
}

function PrimaryHrSourceRow({
  availableSources,
  primary,
  watchAvailability,
  savedHrSource,
  hrConnected,
  bikeConnected,
  onSelect,
  hrReconnectState,
  onConnectHr,
  onAddHr,
  onReplaceHr,
  onForgetHr,
  hrManageOpen,
  onToggleHrManage,
}: PrimaryHrSourceRowProps) {
  return (
    <View style={styles.primaryHrContainer}>
      <Text style={styles.gearLabel}>Heart Rate Source</Text>
      <View style={styles.hrSourceOptions}>
        {availableSources.map((source) => {
          const isSelected = primary === source;
          const isStrap = source === 'bluetooth';

          const actions = isStrap ? (
            <View style={styles.gearActionsStacked}>
              {savedHrSource !== null && !hrConnected ? (
                <ActionButton
                  label={hrReconnectState === 'connecting' ? 'Connecting...' : 'Connect'}
                  onPress={onConnectHr}
                  variant="primary"
                  disabled={hrReconnectState === 'connecting'}
                  fullWidth
                />
              ) : null}
              <ActionButton label="Replace" onPress={onReplaceHr} variant="secondary" fullWidth />
              <ActionButton label="Forget" onPress={onForgetHr} variant="danger" fullWidth />
            </View>
          ) : undefined;

          return (
            <GearTile
              key={source}
              name={hrSourceName(source, savedHrSource?.name ?? null)}
              status={hrSourceIdleReadiness({ source, watchAvailability, hrConnected, bikeConnected })}
              selected={isSelected}
              onSelectPress={() => onSelect(source)}
              headerTestId={`hr-tile-${source}`}
              expandable={isStrap}
              expanded={isStrap ? hrManageOpen : false}
              onToggleExpand={isStrap ? onToggleHrManage : undefined}
              chevronTestId={isStrap ? 'hr-strap-chevron' : undefined}
              actions={actions}
            />
          );
        })}
      </View>
      {savedHrSource === null ? (
        <ActionButton label="Add Bluetooth HR" onPress={onAddHr} variant="secondary" fullWidth />
      ) : null}
    </View>
  );
}

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

// eslint-disable-next-line sonarjs/cognitive-complexity -- large screen component; refactor tracked separately
export function SettingsScreen() {
  const router = useRouter();
  const userProfile = useUserProfileStore((s) => s.profile);
  const { bikeConnected, hrConnected, watchAvailability } = useDeviceConnection();
  const { bikeReconnectState, hrReconnectState, retryBike, retryHr } = useAutoReconnect();
  const { primary, setPrimary, availableSources } = useWatchHrControls();
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

  // Expand/collapse state for gear tiles
  const [bikeManageOpen, setBikeManageOpen] = useState(false);
  const [hrManageOpen, setHrManageOpen] = useState(false);

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

  // Bike tile actions (revealed when expanded)
  const bikeActions = savedBike ? (
    <View style={styles.gearActionsStacked}>
      {bikeConnected ? null : (
        <ActionButton
          label={bikeReconnectState === 'connecting' ? 'Connecting...' : 'Connect'}
          onPress={() => {
            retryBike();
          }}
          variant="primary"
          disabled={bikeReconnectState === 'connecting'}
          fullWidth
        />
      )}
      <ActionButton
        label="Replace"
        onPress={() => router.push('/gear-setup?target=bike')}
        variant="secondary"
        fullWidth
      />
      <ActionButton label="Forget" onPress={() => void forgetBike()} variant="danger" fullWidth />
    </View>
  ) : undefined;

  return (
    <AppScreen title="Settings" subtitle="Manage your saved gear and active connections.">
      <SectionCard title="My Gear">
        {/* BIKE sub-section */}
        <View style={styles.bikeSection}>
          <Text style={styles.gearLabel}>Smart Bike</Text>
          {savedBike ? (
            <GearTile
              name={savedBike.name}
              status={bleDeviceStatus({
                hasSavedDevice: true,
                connected: bikeConnected,
                reconnect: bikeReconnectState,
              })}
              expandable
              expanded={bikeManageOpen}
              onToggleExpand={() => setBikeManageOpen((open) => !open)}
              headerTestId="bike-tile-header"
              chevronTestId="bike-tile-chevron"
              actions={bikeActions}
            />
          ) : (
            <AddGearTile
              label="Set Up Smart Bike"
              onPress={() => router.push('/gear-setup?target=bike')}
              testID="bike-setup-cta"
            />
          )}
        </View>

        <View style={styles.divider} />

        <PrimaryHrSourceRow
          availableSources={availableSources}
          primary={primary}
          watchAvailability={watchAvailability}
          savedHrSource={savedHrSource}
          hrConnected={hrConnected}
          bikeConnected={bikeConnected}
          onSelect={(source) => void setPrimary(source)}
          hrReconnectState={hrReconnectState}
          onConnectHr={() => {
            retryHr();
          }}
          onAddHr={() => router.push('/gear-setup?target=hr')}
          onReplaceHr={() => router.push('/gear-setup?target=hr')}
          onForgetHr={() => void forgetHr()}
          hrManageOpen={hrManageOpen}
          onToggleHrManage={() => setHrManageOpen((open) => !open)}
        />
      </SectionCard>

      <SectionCard title="Personal">
        <View style={styles.gearRow}>
          <View style={styles.gearInfo}>
            <Text style={styles.gearLabel}>User Profile</Text>
            <Text style={styles.gearName}>{summarizeProfile(userProfile)}</Text>
            <Text style={styles.gearHint}>Sex, age, weight, height — used for calorie accuracy</Text>
          </View>
          <View style={styles.gearActions}>
            <ActionButton label="Edit" onPress={() => router.push('/user-profile')} variant="secondary" />
          </View>
        </View>
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
  bikeSection: {
    gap: 8,
  },
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
  gearNameSelected: {
    color: palette.primary,
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
  gearActionsStacked: {
    flexDirection: 'column',
    alignItems: 'stretch',
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
  primaryHrContainer: {
    gap: 8,
  },
  hrSourceOptions: {
    gap: 6,
  },
  // GearTile styles
  gearTile: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: 'hidden',
    flexDirection: 'column',
  },
  gearTileSelected: {
    borderColor: palette.primary,
    backgroundColor: palette.primarySubtle,
  },
  gearTileAccentBar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 4,
    backgroundColor: palette.primary,
    zIndex: 1,
  },
  gearTileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gearTileBody: {
    flex: 1,
    padding: 10,
    paddingLeft: 14,
  },
  gearTileStatus: { marginTop: 6 },
  gearTileChevron: {
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gearTileActions: {
    paddingHorizontal: 10,
    paddingBottom: 10,
    paddingTop: 4,
    gap: 8,
    flexDirection: 'column',
    alignItems: 'stretch',
  },
});
