import { useRouter } from 'expo-router';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';

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
    'This device does not broadcast a standard heart-rate signal. Only HR monitors and compatible watches in broadcast mode are supported.',
  missing_hr_characteristic: 'This device has the HR service but is missing the HR Measurement characteristic.',
  no_live_signal:
    'Device connected but no data received within 8 seconds. Make sure the bike is powered on, then try again.',
};

const SAVE_LABEL: Record<GearType, string> = {
  bike: 'Use This Bike',
  hr: 'Use This HR Source',
};

interface GearSetupScreenProps {
  target: GearType;
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

  const handleScanPress = async () => {
    await startScan().catch(() => {
      Alert.alert('Bluetooth Permission Required', 'Allow Omni Bike to access Bluetooth in Settings.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => void Linking.openSettings() },
      ]);
    });
  };

  const handleSave = async () => {
    await save();
    router.back();
  };

  const title = target === 'bike' ? 'Select Bike' : 'Select HR Source';
  const subtitle =
    target === 'bike'
      ? 'Choose your FTMS-compatible bike trainer. A live signal is required before saving.'
      : 'Choose a Bluetooth HR monitor or broadcast-capable watch. A live signal is required before saving.';

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
});
