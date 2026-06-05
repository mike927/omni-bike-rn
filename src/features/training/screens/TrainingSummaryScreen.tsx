import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  POST_FINISH_TRAINING_SUMMARY_SOURCE,
  shouldShowSummaryHeaderBack,
  type TrainingSummarySource,
} from '../navigation/trainingSummaryRoute';
import { deleteSession, getSamplesBySessionId, getSessionById } from '../../../services/db/trainingSessionRepository';
import { getProviderUpload } from '../../../services/db/providerUploadRepository';
import { APPLE_HEALTH_PROVIDER_ID, STRAVA_PROVIDER_ID } from '../../../services/export/providerIds';
import { uploadSessionToProvider } from '../../../services/export/uploadOrchestrator';
import { useAppleHealthConnectionStore } from '../../../store/appleHealthConnectionStore';
import { useStravaConnectionStore } from '../../../store/stravaConnectionStore';
import type {
  PersistedProviderUpload,
  PersistedTrainingSample,
  PersistedTrainingSession,
} from '../../../types/sessionPersistence';
import { ActionButton } from '../../../ui/components/ActionButton';
import { noir } from '../../../ui/theme';
import { EffortStatTile } from '../components/EffortStatTile';
import { PowerTrend } from '../components/PowerTrend';
import { RideCompleteHero } from '../components/RideCompleteHero';
import { deriveSummaryView } from './summaryViewModel';

const HOME_ROUTE = '/';
const SETTINGS_ROUTE = '/(tabs)/settings';
const STRAVA_PROVIDER_LABEL = 'Strava';
const APPLE_HEALTH_PROVIDER_LABEL = 'Apple Health';

interface TrainingSummaryScreenProps {
  sessionId: string;
  source: TrainingSummarySource;
  returnTo: string | null;
}

function uploadButtonLabel(providerName: string, upload: PersistedProviderUpload | null, isUploading: boolean): string {
  if (isUploading || upload?.uploadState === 'uploading') return 'Uploading…';
  if (upload?.uploadState === 'failed') return `Retry ${providerName}`;
  if (upload?.uploadState === 'uploaded') return `${providerName} ✓`;
  return providerName;
}

function failedMessage(upload: PersistedProviderUpload | null, providerLabel: string): string | null {
  if (upload?.uploadState !== 'failed') return null;
  return upload.errorMessage
    ? `${providerLabel} upload failed: ${upload.errorMessage}`
    : `${providerLabel} upload failed.`;
}

export function TrainingSummaryScreen({ sessionId, source, returnTo }: Readonly<TrainingSummaryScreenProps>) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [session, setSession] = useState<PersistedTrainingSession | null>(null);
  const [samples, setSamples] = useState<readonly PersistedTrainingSample[]>([]);
  const [providerUpload, setProviderUpload] = useState<PersistedProviderUpload | null>(null);
  const [appleHealthUpload, setAppleHealthUpload] = useState<PersistedProviderUpload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingAppleHealth, setIsUploadingAppleHealth] = useState(false);
  const isPostFinishSource = source === POST_FINISH_TRAINING_SUMMARY_SOURCE;
  const primaryActionLabel = isPostFinishSource ? 'Save' : 'Done';
  const exitRoute = returnTo ?? HOME_ROUTE;

  useEffect(() => {
    if (!sessionId) {
      setIsLoading(false);
      return;
    }

    try {
      const loaded = getSessionById(sessionId);
      setSession(loaded);
      setSamples(loaded ? getSamplesBySessionId(sessionId) : []);
      setProviderUpload(getProviderUpload(sessionId, STRAVA_PROVIDER_ID));
      setAppleHealthUpload(getProviderUpload(sessionId, APPLE_HEALTH_PROVIDER_ID));
    } catch (err: unknown) {
      // Degrade to the not-found state rather than white-screening the summary.
      console.error('[TrainingSummaryScreen] Failed to load session summary:', err);
      setSession(null);
      setSamples([]);
      setProviderUpload(null);
      setAppleHealthUpload(null);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  const handleDiscard = () => {
    Alert.alert('Discard Workout', 'This workout will be permanently deleted. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          try {
            deleteSession(sessionId);
          } catch (err: unknown) {
            console.error('[TrainingSummaryScreen] Failed to delete session:', err);
          }
          router.replace(exitRoute);
        },
      },
    ]);
  };

  const handlePrimaryAction = () => {
    router.replace(exitRoute);
  };

  const handleUploadToStrava = async () => {
    if (!useStravaConnectionStore.getState().connected) {
      Alert.alert('Strava Not Connected', 'Connect your Strava account in Settings to upload workouts.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Go to Settings', onPress: () => router.push(SETTINGS_ROUTE) },
      ]);
      return;
    }

    setIsUploading(true);

    try {
      const result = await uploadSessionToProvider(sessionId, STRAVA_PROVIDER_ID);
      setProviderUpload(getProviderUpload(sessionId, STRAVA_PROVIDER_ID));

      if (!result.success) {
        Alert.alert(
          'Upload Failed',
          result.errorMessage ?? `This workout could not be uploaded to ${STRAVA_PROVIDER_LABEL}.`,
        );
        return;
      }

      Alert.alert(
        'Upload Complete',
        result.warningMessage
          ? `This workout was uploaded to ${STRAVA_PROVIDER_LABEL}. ${result.warningMessage}`
          : `This workout was uploaded to ${STRAVA_PROVIDER_LABEL}.`,
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : `This workout could not be uploaded to ${STRAVA_PROVIDER_LABEL}.`;
      console.error('[TrainingSummaryScreen] Failed to upload workout:', err);
      setProviderUpload(getProviderUpload(sessionId, STRAVA_PROVIDER_ID));
      Alert.alert('Upload Failed', message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleUploadToAppleHealth = async () => {
    if (!useAppleHealthConnectionStore.getState().connected) {
      Alert.alert('Apple Health Not Connected', 'Connect Apple Health in Settings to save workouts there.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Go to Settings', onPress: () => router.push(SETTINGS_ROUTE) },
      ]);
      return;
    }

    setIsUploadingAppleHealth(true);

    try {
      const result = await uploadSessionToProvider(sessionId, APPLE_HEALTH_PROVIDER_ID);
      setAppleHealthUpload(getProviderUpload(sessionId, APPLE_HEALTH_PROVIDER_ID));

      if (!result.success) {
        Alert.alert(
          'Upload Failed',
          result.errorMessage ?? `This workout could not be saved to ${APPLE_HEALTH_PROVIDER_LABEL}.`,
        );
        return;
      }

      Alert.alert(
        'Saved to Apple Health',
        result.warningMessage
          ? `This workout was saved to ${APPLE_HEALTH_PROVIDER_LABEL}. ${result.warningMessage}`
          : `This workout was saved to ${APPLE_HEALTH_PROVIDER_LABEL}.`,
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : `This workout could not be saved to ${APPLE_HEALTH_PROVIDER_LABEL}.`;
      console.error('[TrainingSummaryScreen] Failed to save workout to Apple Health:', err);
      setAppleHealthUpload(getProviderUpload(sessionId, APPLE_HEALTH_PROVIDER_ID));
      Alert.alert('Upload Failed', message);
    } finally {
      setIsUploadingAppleHealth(false);
    }
  };

  // Hidden right after finishing a ride (force an explicit Save / Discard); shown when
  // viewing an already-saved workout so the chevron returns to where it was opened from.
  const showBack = shouldShowSummaryHeaderBack(source);
  const header = (
    <View style={styles.header}>
      {showBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={10}
          onPress={() => router.replace(exitRoute)}
          style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}>
          <Ionicons name="chevron-back" size={22} color={noir.ink2} />
        </Pressable>
      ) : (
        <View style={styles.headerSpacer} />
      )}
      <Text style={styles.headerTitle}>Summary</Text>
      <View style={styles.headerSpacer} />
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        {header}
        <View style={styles.placeholderWrap}>
          <View style={styles.placeholderCard}>
            <Text style={styles.bodyText}>Retrieving your workout…</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        {header}
        <View style={styles.placeholderWrap}>
          <View style={styles.placeholderCard}>
            <Text style={styles.notFoundTitle}>Workout Not Found</Text>
            <Text style={styles.bodyText}>
              The requested workout could not be found. It may have been discarded or the session was not saved.
            </Text>
            <ActionButton label="Back Home" scheme="noir" fullWidth onPress={() => router.replace(HOME_ROUTE)} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const vm = deriveSummaryView({ session, samples });
  const stravaFailed = failedMessage(providerUpload, STRAVA_PROVIDER_LABEL);
  const appleFailed = failedMessage(appleHealthUpload, APPLE_HEALTH_PROVIDER_LABEL);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      {header}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <RideCompleteHero hero={vm.hero} />

        <Text style={styles.sectionLabel}>Your Effort</Text>
        <View style={styles.statGrid}>
          {vm.effort.map((stat) => (
            <View key={stat.key} style={styles.statCell}>
              <EffortStatTile
                label={stat.label}
                value={stat.value}
                unit={stat.unit}
                peakLabel={stat.peakLabel}
                accent={stat.accent}
              />
            </View>
          ))}
        </View>

        {vm.powerTrend.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>Power Through The Ride</Text>
            <View style={styles.trendCard}>
              <Text style={styles.trendTitle}>Power</Text>
              <PowerTrend samples={vm.powerTrend} />
            </View>
          </>
        ) : null}

        <Text style={styles.sectionLabel}>Share This Ride</Text>
        <View style={styles.shareRow}>
          <View style={styles.shareBtn}>
            <ActionButton
              scheme="noir"
              variant="secondary"
              fullWidth
              label={uploadButtonLabel(STRAVA_PROVIDER_LABEL, providerUpload, isUploading)}
              disabled={isUploading || providerUpload?.uploadState === 'uploaded'}
              onPress={() => {
                void handleUploadToStrava();
              }}
            />
          </View>
          <View style={styles.shareBtn}>
            <ActionButton
              scheme="noir"
              variant="secondary"
              fullWidth
              label={uploadButtonLabel(APPLE_HEALTH_PROVIDER_LABEL, appleHealthUpload, isUploadingAppleHealth)}
              disabled={isUploadingAppleHealth || appleHealthUpload?.uploadState === 'uploaded'}
              onPress={() => {
                void handleUploadToAppleHealth();
              }}
            />
          </View>
        </View>
        {stravaFailed ? <Text style={styles.failedCaption}>{stravaFailed}</Text> : null}
        {appleFailed ? <Text style={styles.failedCaption}>{appleFailed}</Text> : null}
        {vm.gearLabel ? <Text style={styles.gearCaption}>Recorded on {vm.gearLabel}</Text> : null}
      </ScrollView>

      <View style={[styles.actionBar, { paddingBottom: insets.bottom + 14 }]}>
        <View style={styles.actionRow}>
          <View style={styles.actionBtn}>
            <ActionButton scheme="noir" variant="danger" fullWidth label="Discard" onPress={handleDiscard} />
          </View>
          <View style={styles.actionBtn}>
            <ActionButton
              scheme="noir"
              variant="primary"
              fullWidth
              label={primaryActionLabel}
              onPress={handlePrimaryAction}
            />
          </View>
        </View>
      </View>
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
  sectionLabel: { color: noir.ink, fontSize: 14, fontWeight: '700', marginTop: 18, marginBottom: 10, marginLeft: 4 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  statCell: { width: '48%', flexGrow: 1 },
  trendCard: {
    backgroundColor: noir.card,
    borderWidth: 1,
    borderColor: noir.hairline,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 10,
  },
  trendTitle: { color: noir.ink, fontSize: 13, fontWeight: '700' },
  shareRow: { flexDirection: 'row', gap: 10 },
  shareBtn: { flex: 1 },
  failedCaption: { color: noir.dangerSoft, fontSize: 12.5, fontWeight: '600', marginTop: 10, marginLeft: 4 },
  gearCaption: { color: noir.ink3, fontSize: 12.5, fontWeight: '500', marginTop: 10, marginLeft: 4 },
  placeholderWrap: { flex: 1, paddingHorizontal: 22, paddingTop: 6 },
  placeholderCard: {
    backgroundColor: noir.card,
    borderWidth: 1,
    borderColor: noir.hairline,
    borderRadius: 20,
    padding: 18,
    gap: 12,
  },
  notFoundTitle: { color: noir.ink, fontSize: 16, fontWeight: '800' },
  bodyText: { color: noir.ink2, fontSize: 14, lineHeight: 22 },
  actionBar: {
    paddingHorizontal: 22,
    paddingTop: 12,
    backgroundColor: noir.bg,
    borderTopWidth: 1,
    borderTopColor: noir.hairline,
  },
  actionRow: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1 },
});
