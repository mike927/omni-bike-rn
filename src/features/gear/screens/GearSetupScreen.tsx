import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { useGearSetup } from '../hooks/useGearSetup';
import { ActionButton } from '../../../ui/components/ActionButton';
import { SectionCard } from '../../../ui/components/SectionCard';
import { AppScreen } from '../../../ui/layout/AppScreen';
import { palette } from '../../../ui/theme';
import type { GearType, ValidationFailureReason } from '../../../types/gear';

const INCOMPATIBILITY_MESSAGES: Record<ValidationFailureReason, string> = {
  missing_ftms_service:
    'This device does not support the Fitness Machine Service (FTMS). Only FTMS-compatible bike trainers can be used.',
  missing_indoor_bike_characteristic:
    'This device uses FTMS but does not broadcast indoor bike data. It may be a different type of fitness machine.',
  missing_hr_service:
    'This device is not broadcasting a standard Bluetooth heart-rate signal. Only Bluetooth HR monitors and watches in broadcast or HR sensor mode are supported — if you are pairing a watch, make sure broadcast mode is enabled (see hint below).',
  missing_hr_characteristic: 'This device has the HR service but is missing the HR Measurement characteristic.',
  connection_failed:
    'Could not complete the Bluetooth connection. Make sure the device is awake and in sensor mode, then try again.',
  no_live_signal:
    'Device connected but no data arrived within 8 seconds. Make sure it is awake and actively sending data, then try again.',
};

const HR_BROADCAST_HINT_ERRORS: ReadonlySet<ValidationFailureReason> = new Set<ValidationFailureReason>([
  'missing_hr_service',
  'missing_hr_characteristic',
  'no_live_signal',
]);

const HR_BROADCAST_HINT = {
  headline: 'Pairing a Garmin or Polar watch?',
  steps: [
    'On your Garmin watch (Fenix / Forerunner / Venu / Vivoactive): hold UP to open the menu.',
    'Go to Settings → Sensors & Accessories → Wrist Heart Rate.',
    'Select Broadcast HR (or Broadcast During Activity).',
    'Confirm the broadcast icon appears on the watch face before you return to this screen.',
  ],
  footer:
    'Polar watches: see your model\u2019s manual for the broadcast-mode button path. Some watches stop broadcasting when the display sleeps — keep the watch awake during pairing.',
} as const;

const SAVE_LABEL: Record<GearType, string> = {
  bike: 'Use This Bike',
  hr: 'Use This HR Source',
};

interface GearSetupScreenProps {
  target: GearType;
}

interface HintBlockProps {
  headline: string;
  expanded: boolean;
  onToggle: () => void;
  testID?: string;
  children: React.ReactNode;
}

function HintBlock({ headline, expanded, onToggle, testID, children }: HintBlockProps) {
  return (
    <View style={styles.hintContainer} testID={testID}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={onToggle}
        style={styles.hintToggleRow}>
        <Text style={styles.hintHeadline}>{headline}</Text>
        <Text style={styles.hintCaret}>{expanded ? '▾' : '▸'}</Text>
      </Pressable>
      {expanded ? <View style={styles.hintBody}>{children}</View> : null}
    </View>
  );
}

export function GearSetupScreen({ target }: GearSetupScreenProps) {
  const router = useRouter();
  const {
    step,
    devices,
    isScanning,
    scanError,
    selectedDevice,
    validationError,
    signalConfirmed,
    startScan,
    stopScan,
    selectDevice,
    save,
    reset,
  } = useGearSetup(target);
  const [broadcastHintExpanded, setBroadcastHintExpanded] = useState(false);

  const showBroadcastHint =
    target === 'hr' && validationError !== null && HR_BROADCAST_HINT_ERRORS.has(validationError);

  const renderBroadcastHint = (testID: string) => (
    <HintBlock
      testID={testID}
      headline={HR_BROADCAST_HINT.headline}
      expanded={broadcastHintExpanded}
      onToggle={() => setBroadcastHintExpanded((prev) => !prev)}>
      {HR_BROADCAST_HINT.steps.map((stepText, index) => (
        <Text key={index} style={styles.hintStep}>
          {index + 1}. {stepText}
        </Text>
      ))}
      <Text style={styles.hintFooter}>{HR_BROADCAST_HINT.footer}</Text>
    </HintBlock>
  );

  const handleScanPress = async () => {
    const permission = await startScan();

    if (permission === 'denied') {
      Alert.alert('Bluetooth Permission Required', 'Allow Omni Bike to access Bluetooth in Settings.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => void Linking.openSettings() },
      ]);
    }
  };

  const handleSave = async () => {
    await save();
    router.back();
  };

  const title = target === 'bike' ? 'Select Bike' : 'Select Bluetooth HR Source';
  const subtitle =
    target === 'bike'
      ? 'Choose your FTMS-compatible bike trainer. A live signal is required before saving.'
      : 'Choose a Bluetooth HR monitor or a watch in broadcast or HR sensor mode. A live signal is required before saving.';

  return (
    <AppScreen title={title} subtitle={subtitle}>
      <SectionCard title="Scan Controls">
        {scanError ? <Text style={styles.errorText}>{scanError}</Text> : null}
        <ActionButton
          label={isScanning ? 'Stop Scan' : 'Start Scan'}
          onPress={isScanning ? stopScan : handleScanPress}
          fullWidth
        />
      </SectionCard>

      {devices.length === 0 && !isScanning ? null : (
        <SectionCard title="Nearby Devices">
          {devices.length === 0 ? (
            <Text style={styles.emptyText}>Scanning for nearby devices…</Text>
          ) : (
            devices.map((device) => {
              const isSelected = selectedDevice?.id === device.id;
              const showError = isSelected && validationError !== null;

              return (
                <View key={device.id} style={styles.deviceRow}>
                  <View style={styles.deviceText}>
                    <Text style={styles.deviceName}>{device.name ?? 'Unknown Device'}</Text>
                    <Text style={styles.deviceId}>{device.id}</Text>
                    {showError && validationError ? (
                      <Text style={styles.incompatibilityText}>{INCOMPATIBILITY_MESSAGES[validationError]}</Text>
                    ) : null}
                    {showError && showBroadcastHint ? renderBroadcastHint('broadcast-hint-inline') : null}
                    {isSelected && step === 'validating' ? (
                      <Text style={styles.statusText}>Validating device…</Text>
                    ) : null}
                    {isSelected && step === 'connecting' ? <Text style={styles.statusText}>Connecting…</Text> : null}
                    {isSelected && step === 'awaiting_signal' ? (
                      <Text style={styles.statusText}>Waiting for live signal…</Text>
                    ) : null}
                    {isSelected && signalConfirmed ? <Text style={styles.signalText}>Signal received ✓</Text> : null}
                  </View>
                  {!isSelected || step === 'error' ? (
                    <ActionButton
                      label="Select"
                      onPress={() => void selectDevice(device)}
                      variant="ghost"
                      disabled={step === 'validating' || step === 'connecting' || step === 'awaiting_signal'}
                    />
                  ) : null}
                </View>
              );
            })
          )}
        </SectionCard>
      )}

      {step === 'error' && validationError ? (
        <SectionCard title="Device Issue">
          <Text style={styles.errorText}>{INCOMPATIBILITY_MESSAGES[validationError]}</Text>
          {showBroadcastHint ? renderBroadcastHint('broadcast-hint-card') : null}
          <ActionButton label="Try Another Device" onPress={reset} fullWidth />
        </SectionCard>
      ) : null}

      <ActionButton
        label={SAVE_LABEL[target]}
        onPress={() => void handleSave()}
        disabled={!signalConfirmed}
        fullWidth
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  deviceRow: {
    gap: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surfaceMuted,
    padding: 14,
  },
  deviceText: {
    gap: 4,
  },
  deviceName: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '700',
  },
  deviceId: {
    color: palette.textMuted,
    fontSize: 12,
  },
  incompatibilityText: {
    color: palette.danger,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  statusText: {
    color: palette.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  signalText: {
    color: palette.success,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  errorText: {
    color: palette.danger,
    fontSize: 14,
    lineHeight: 20,
  },
  emptyText: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  hintContainer: {
    marginTop: 4,
    gap: 6,
  },
  hintToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  hintHeadline: {
    color: palette.textMuted,
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  hintCaret: {
    color: palette.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  hintBody: {
    gap: 6,
    marginTop: 4,
  },
  hintStep: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  hintFooter: {
    color: palette.textMuted,
    fontSize: 12,
    fontStyle: 'italic',
    lineHeight: 16,
    marginTop: 2,
  },
});
