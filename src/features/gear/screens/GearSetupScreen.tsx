import React, { useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useGearSetup } from '../hooks/useGearSetup';
import { LiveSignalHero } from '../components/LiveSignalHero';
import { NearbyDeviceRow } from '../components/NearbyDeviceRow';
import { PickedDeviceChip } from '../components/PickedDeviceChip';
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
    'Open your watch\u2019s main menu. The button varies by family: hold UP on Fenix / Forerunner / Instinct, or press the top-right button on Venu / Vivoactive.',
    'Navigate to Settings → Sensors & Accessories → Wrist Heart Rate (newer models) or Settings → Wrist Heart Rate (older models).',
    'Select Broadcast Heart Rate, or enable Broadcast During Activity and then start an activity on the watch.',
    'Confirm the broadcast icon appears on the watch face before returning to this screen.',
  ],
  footer:
    'Menu labels and button paths vary by model and firmware — when in doubt, check your watch\u2019s owner manual for the exact "broadcast heart rate" step. Polar watches: see your model\u2019s manual for the broadcast-mode button path. Some watches stop broadcasting when the display sleeps — keep the watch awake during pairing. Note: not every Garmin watch actually broadcasts over Bluetooth; some older models only broadcast over ANT+, which iPhones cannot receive.',
} as const;

const SAVE_LABEL: Record<GearType, string> = {
  bike: 'Use This Smart Bike',
  hr: 'Use This HR Source',
};

const STEP_STATUS = (step: string): 'connecting' | 'ready' => (step === 'ready' ? 'ready' : 'connecting');

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
    latestBikeMetrics,
    latestBluetoothHr,
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

  const subtitle =
    target === 'bike'
      ? 'Pick your FTMS bike. We confirm it by showing live data before you save.'
      : 'Pick a Bluetooth HR monitor or a watch in broadcast mode. We confirm it with a live signal before saving.';
  const scanLabel = target === 'bike' ? 'Search for Smart Bike' : 'Search for HR Source';
  const chooseAnotherLabel = target === 'bike' ? 'Choose Another Bike' : 'Choose Another Device';

  const isPicked = selectedDevice !== null && step !== 'scanning';
  const isError = step === 'error';

  let title: string;
  if (isPicked) {
    title = target === 'bike' ? 'Confirm Smart Bike' : 'Confirm HR Source';
  } else {
    title = target === 'bike' ? 'Select Smart Bike' : 'Select Bluetooth HR Source';
  }

  const renderPickedBody = () =>
    isError && validationError ? (
      <View style={styles.errorCallout}>
        <Text style={styles.errorTitle}>This device can’t be used</Text>
        <Text style={styles.errorBody}>{INCOMPATIBILITY_MESSAGES[validationError]}</Text>
        {showBroadcastHint ? renderBroadcastHint('broadcast-hint-card') : null}
      </View>
    ) : (
      <View style={styles.heroGap}>
        <LiveSignalHero
          target={target}
          confirmed={signalConfirmed}
          bikeMetrics={latestBikeMetrics}
          hrBpm={latestBluetoothHr}
        />
      </View>
    );

  const renderScanList = () =>
    devices.length === 0 ? (
      <View style={styles.emptyRow}>
        <Text style={styles.emptyText}>
          {isScanning ? 'Scanning for nearby devices…' : 'No devices yet — keep your bike awake.'}
        </Text>
      </View>
    ) : (
      devices.map((device) => (
        <View key={device.id} style={styles.rowGap}>
          <NearbyDeviceRow
            name={device.name}
            deviceId={device.id}
            target={target}
            onSelect={() => void selectDevice(device)}
          />
        </View>
      ))
    );

  const renderSaveAction = () => (
    <Pressable
      accessibilityRole="button"
      disabled={!signalConfirmed}
      onPress={() => void handleSave()}
      style={({ pressed }) => [
        styles.primaryBtn,
        !signalConfirmed && styles.primaryDisabled,
        pressed && styles.primaryPressed,
      ]}>
      <Text style={[styles.primaryLabel, !signalConfirmed && styles.primaryLabelDisabled]}>{SAVE_LABEL[target]}</Text>
    </Pressable>
  );

  const renderTextAction = (label: string, onPress: () => void) => (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.primaryBtn, pressed && styles.primaryPressed]}>
      <Text style={styles.primaryLabel}>{label}</Text>
    </Pressable>
  );

  const renderAction = () => {
    if (!isPicked) {
      return renderTextAction(isScanning ? 'Stop' : scanLabel, isScanning ? stopScan : () => void handleScanPress());
    }
    if (isError) {
      return renderTextAction(chooseAnotherLabel, reset);
    }
    return renderSaveAction();
  };

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
        {isPicked ? (
          <>
            <PickedDeviceChip
              name={selectedDevice?.name ?? selectedDevice?.id ?? 'Selected device'}
              status={STEP_STATUS(step)}
              target={target}
              errored={isError}
              onSwap={reset}
            />
            {renderPickedBody()}
          </>
        ) : (
          <>
            <Text style={styles.subtitle}>{subtitle}</Text>
            {scanError ? <Text style={styles.errorText}>{scanError}</Text> : null}
            <Text style={styles.sectionLabel}>Nearby Devices</Text>
            {renderScanList()}
          </>
        )}
      </ScrollView>

      <View style={styles.actionBar}>{renderAction()}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: noir.bg },
  content: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 24, gap: 12 },
  subtitle: { color: noir.ink2, fontSize: 14.5, lineHeight: 20, marginTop: 6 },
  sectionLabel: { color: noir.ink, fontSize: 14, fontWeight: '700', marginTop: 10 },
  rowGap: { marginTop: 0 },
  heroGap: { marginTop: 2 },
  emptyRow: {
    backgroundColor: noir.card,
    borderWidth: 1,
    borderColor: noir.hairline,
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
  },
  emptyText: { color: noir.ink3, fontSize: 13 },
  errorCallout: {
    backgroundColor: 'rgba(239,75,92,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239,75,92,0.22)',
    borderRadius: 20,
    padding: 16,
    gap: 8,
  },
  errorTitle: { color: noir.ink, fontSize: 15, fontWeight: '700' },
  errorBody: { color: noir.ink2, fontSize: 13.5, lineHeight: 19 },
  errorText: { color: noir.dangerSoft, fontSize: 14, lineHeight: 20 },
  actionBar: { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 22, gap: 10 },
  primaryBtn: {
    height: 52,
    borderRadius: 16,
    backgroundColor: noir.indigo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryPressed: { backgroundColor: noir.indigoPress },
  primaryDisabled: { backgroundColor: '#1b2230' },
  primaryLabel: { color: noir.ink, fontSize: 15, fontWeight: '700' },
  primaryLabelDisabled: { color: noir.ink3 },
  hintContainer: { marginTop: 4, gap: 6 },
  hintToggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  hintHeadline: { color: noir.ink2, fontSize: 13, fontWeight: '600', flexShrink: 1 },
  hintCaret: { color: noir.ink2, fontSize: 13, fontWeight: '600' },
  hintBody: { gap: 6, marginTop: 4 },
  hintStep: { color: noir.ink2, fontSize: 13, lineHeight: 18 },
  hintFooter: { color: noir.ink3, fontSize: 12, fontStyle: 'italic', lineHeight: 16, marginTop: 2 },
});
