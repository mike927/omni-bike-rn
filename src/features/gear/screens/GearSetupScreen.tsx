import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useGearSetup } from '../hooks/useGearSetup';
import { NearbyDeviceRow, type NearbyDeviceRowState } from '../components/NearbyDeviceRow';
import { noir } from '../../../ui/theme';
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
    'Open your watch’s main menu. The button varies by family: hold UP on Fenix / Forerunner / Instinct, or press the top-right button on Venu / Vivoactive.',
    'Navigate to Settings → Sensors & Accessories → Wrist Heart Rate (newer models) or Settings → Wrist Heart Rate (older models).',
    'Select Broadcast Heart Rate, or enable Broadcast During Activity and then start an activity on the watch.',
    'Confirm the broadcast icon appears on the watch face before returning to this screen.',
  ],
  footer:
    'Menu labels and button paths vary by model and firmware — when in doubt, check your watch’s owner manual for the exact "broadcast heart rate" step. Polar watches: see your model’s manual for the broadcast-mode button path. Some watches stop broadcasting when the display sleeps — keep the watch awake during pairing. Note: not every Garmin watch actually broadcasts over Bluetooth; some older models only broadcast over ANT+, which iPhones cannot receive.',
} as const;

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

function HintBlock({ headline, expanded, onToggle, testID, children }: Readonly<HintBlockProps>) {
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

const CONNECTING_STEPS: ReadonlySet<string> = new Set(['validating', 'connecting', 'awaiting_signal']);

export function GearSetupScreen({ target }: Readonly<GearSetupScreenProps>) {
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
  } = useGearSetup(target);
  const [broadcastHintExpanded, setBroadcastHintExpanded] = useState(false);
  const savedRef = useRef(false);

  const runScan = useCallback(async () => {
    const permission = await startScan();
    if (permission === 'denied') {
      Alert.alert('Bluetooth Permission Required', 'Allow Omni Bike to access Bluetooth in Settings.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => void Linking.openSettings() },
      ]);
    }
  }, [startScan]);

  // Start scanning automatically when the screen opens — no separate "search" step.
  useEffect(() => {
    void runScan();
  }, [runScan]);

  // Pairing completes the moment a selected device connects and streams a live
  // signal: save it and leave. No manual confirmation step.
  useEffect(() => {
    if (step === 'ready' && signalConfirmed && !savedRef.current) {
      savedRef.current = true;
      void (async () => {
        await save();
        router.back();
      })();
    }
  }, [step, signalConfirmed, save, router]);

  const deviceState = (id: string): NearbyDeviceRowState => {
    if (selectedDevice?.id !== id) return 'idle';
    if (step === 'error') return 'error';
    if (CONNECTING_STEPS.has(step)) return 'connecting';
    return 'idle';
  };

  const renderBroadcastHint = () => (
    <HintBlock
      testID="broadcast-hint-inline"
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

  const title = target === 'bike' ? 'Select Smart Bike' : 'Select Bluetooth HR Source';
  const subtitle =
    target === 'bike'
      ? 'Tap your FTMS bike to pair. It connects and verifies a live signal, then saves automatically.'
      : 'Tap a Bluetooth HR monitor or a watch in broadcast mode. It connects and verifies a live signal, then saves automatically.';

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safeArea}>
      <Stack.Screen
        options={{
          title,
          headerStyle: { backgroundColor: noir.bg },
          headerTintColor: noir.ink,
        }}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>{subtitle}</Text>
        {scanError ? <Text style={styles.errorText}>{scanError}</Text> : null}

        <View style={styles.listHead}>
          <Text style={styles.sectionLabel}>Nearby Devices</Text>
          <Pressable accessibilityRole="button" onPress={isScanning ? stopScan : () => void runScan()} hitSlop={8}>
            <Text style={styles.scanToggle}>{isScanning ? 'Stop' : 'Rescan'}</Text>
          </Pressable>
        </View>

        {devices.length === 0 ? (
          <View style={styles.emptyRow}>
            <Text style={styles.emptyText}>
              {isScanning ? 'Scanning for nearby devices…' : 'No devices found — keep your bike awake and rescan.'}
            </Text>
          </View>
        ) : (
          devices.map((device) => {
            const rowState = deviceState(device.id);
            const showHint =
              rowState === 'error' &&
              target === 'hr' &&
              validationError !== null &&
              HR_BROADCAST_HINT_ERRORS.has(validationError);

            return (
              <NearbyDeviceRow
                key={device.id}
                name={device.name}
                deviceId={device.id}
                target={target}
                state={rowState}
                errorMessage={
                  rowState === 'error' && validationError ? INCOMPATIBILITY_MESSAGES[validationError] : null
                }
                onSelect={() => void selectDevice(device)}>
                {showHint ? renderBroadcastHint() : null}
              </NearbyDeviceRow>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: noir.bg },
  content: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 24, gap: 10 },
  subtitle: { color: noir.ink2, fontSize: 14.5, lineHeight: 20, marginTop: 6 },
  listHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: 2,
  },
  sectionLabel: { color: noir.ink, fontSize: 14, fontWeight: '700' },
  scanToggle: { color: noir.indigoSoft, fontSize: 13, fontWeight: '700' },
  emptyRow: {
    backgroundColor: noir.card,
    borderWidth: 1,
    borderColor: noir.hairline,
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
  },
  emptyText: { color: noir.ink3, fontSize: 13, textAlign: 'center' },
  errorText: { color: noir.dangerSoft, fontSize: 14, lineHeight: 20 },
  hintContainer: { marginTop: 4, gap: 6 },
  hintToggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  hintHeadline: { color: noir.ink2, fontSize: 13, fontWeight: '600', flexShrink: 1 },
  hintCaret: { color: noir.ink2, fontSize: 13, fontWeight: '600' },
  hintBody: { gap: 6, marginTop: 4 },
  hintStep: { color: noir.ink2, fontSize: 13, lineHeight: 18 },
  hintFooter: { color: noir.ink3, fontSize: 12, fontStyle: 'italic', lineHeight: 16, marginTop: 2 },
});
