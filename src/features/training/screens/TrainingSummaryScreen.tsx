import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { POST_FINISH_TRAINING_SUMMARY_SOURCE, type TrainingSummarySource } from '../navigation/trainingSummaryRoute';
import { deleteSession, getSessionById } from '../../../services/db/trainingSessionRepository';
import { getProviderUpload } from '../../../services/db/providerUploadRepository';
import { uploadSessionToProvider } from '../../../services/export/uploadOrchestrator';
import { useStravaConnectionStore } from '../../../store/stravaConnectionStore';
import type { PersistedProviderUpload, PersistedTrainingSession } from '../../../types/sessionPersistence';
import { ActionButton } from '../../../ui/components/ActionButton';
import { MetricTile } from '../../../ui/components/MetricTile';
import { SectionCard } from '../../../ui/components/SectionCard';
import { formatDistanceKm, formatDuration, formatMetricValue } from '../../../ui/formatters';
import { AppScreen } from '../../../ui/layout/AppScreen';
import { palette } from '../../../ui/theme';

const HOME_ROUTE = '/';
const SETTINGS_ROUTE = '/(tabs)/settings';
const STRAVA_PROVIDER_ID = 'strava';
const STRAVA_PROVIDER_LABEL = 'Strava';

interface TrainingSummaryScreenProps {
  sessionId: string;
  source: TrainingSummarySource;
  returnTo: string | null;
}

function getUploadButtonLabel(upload: PersistedProviderUpload | null, isUploading: boolean): string {
  if (isUploading || upload?.uploadState === 'uploading') {
    return 'Uploading...';
  }

  if (upload?.uploadState === 'failed') {
    return `Retry ${STRAVA_PROVIDER_LABEL}`;
  }

  if (upload?.uploadState === 'uploaded') {
    return `${STRAVA_PROVIDER_LABEL} Uploaded`;
  }

  return `Upload to ${STRAVA_PROVIDER_LABEL}`;
}

function getUploadStatusMessage(upload: PersistedProviderUpload | null): string {
  if (!upload || upload.uploadState === 'ready') {
    return `Manually upload this workout to ${STRAVA_PROVIDER_LABEL} when you're ready.`;
  }

  if (upload.uploadState === 'uploading') {
    return `${STRAVA_PROVIDER_LABEL} upload is currently in progress.`;
  }

  if (upload.uploadState === 'uploaded') {
    if (upload.errorMessage) {
      return upload.externalId
        ? `Uploaded to ${STRAVA_PROVIDER_LABEL}. Reference: ${upload.externalId}. ${upload.errorMessage}`
        : `Uploaded to ${STRAVA_PROVIDER_LABEL}. ${upload.errorMessage}`;
    }

    return upload.externalId
      ? `Uploaded to ${STRAVA_PROVIDER_LABEL}. Reference: ${upload.externalId}`
      : `Uploaded to ${STRAVA_PROVIDER_LABEL}.`;
  }

  return upload.errorMessage
    ? `${STRAVA_PROVIDER_LABEL} upload failed: ${upload.errorMessage}`
    : `${STRAVA_PROVIDER_LABEL} upload failed.`;
}

export function TrainingSummaryScreen({ sessionId, source, returnTo }: TrainingSummaryScreenProps) {
  const router = useRouter();
  const [session, setSession] = useState<PersistedTrainingSession | null>(null);
  const [providerUpload, setProviderUpload] = useState<PersistedProviderUpload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const isPostFinishSource = source === POST_FINISH_TRAINING_SUMMARY_SOURCE;
  const primaryActionLabel = isPostFinishSource ? 'Save' : 'Done';
  const exitRoute = returnTo ?? HOME_ROUTE;

  useEffect(() => {
    if (!sessionId) {
      setIsLoading(false);
      return;
    }

    const loaded = getSessionById(sessionId);
    setSession(loaded);
    setProviderUpload(getProviderUpload(sessionId, STRAVA_PROVIDER_ID));
    setIsLoading(false);
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
      const latestUpload = getProviderUpload(sessionId, STRAVA_PROVIDER_ID);
      setProviderUpload(latestUpload);

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

  if (isLoading) {
    return (
      <AppScreen title="Summary" subtitle="Loading workout data...">
        <SectionCard title="Loading...">
          <Text style={styles.bodyText}>Retrieving your workout from the database.</Text>
        </SectionCard>
      </AppScreen>
    );
  }

  if (!session) {
    return (
      <AppScreen title="Summary" subtitle="No workout found for this session.">
        <SectionCard title="Workout Not Found">
          <Text style={styles.bodyText}>
            The requested workout could not be found. It may have been discarded or the session was not saved.
          </Text>
          <ActionButton label="Back Home" onPress={() => router.replace(HOME_ROUTE)} />
        </SectionCard>
      </AppScreen>
    );
  }

  return (
    <AppScreen title="Summary" subtitle="Review your workout results.">
      <View style={styles.screenContent}>
        <SectionCard title="Workout Totals">
          <View style={styles.metricGrid}>
            <MetricTile label="Elapsed" value={formatDuration(session.elapsedSeconds)} style={styles.metricTile} />
            <MetricTile
              label="Distance"
              value={formatDistanceKm(session.totalDistanceMeters)}
              style={styles.metricTile}
            />
            <MetricTile
              label="Calories"
              value={`${session.totalCaloriesKcal.toFixed(1)} kcal`}
              style={styles.metricTile}
            />
          </View>
        </SectionCard>

        <SectionCard title="Final Metrics">
          <View style={styles.metricGrid}>
            <MetricTile
              label="Speed"
              value={`${session.currentMetrics.speed.toFixed(1)} km/h`}
              style={styles.metricTile}
            />
            <MetricTile label="Cadence" value={`${session.currentMetrics.cadence} rpm`} style={styles.metricTile} />
            <MetricTile label="Power" value={`${session.currentMetrics.power} W`} style={styles.metricTile} />
            <MetricTile
              label="Heart Rate"
              value={formatMetricValue(session.currentMetrics.heartRate, ' bpm')}
              style={styles.metricTile}
            />
          </View>
        </SectionCard>

        <SectionCard title={`${STRAVA_PROVIDER_LABEL} Upload`}>
          <Text style={styles.bodyText}>{getUploadStatusMessage(providerUpload)}</Text>
          <View style={styles.uploadActionRow}>
            <ActionButton
              label={getUploadButtonLabel(providerUpload, isUploading)}
              onPress={() => {
                void handleUploadToStrava();
              }}
              variant="secondary"
              disabled={isUploading || providerUpload?.uploadState === 'uploaded'}
            />
          </View>
        </SectionCard>

        <View style={styles.actionRow}>
          <ActionButton label="Discard" onPress={handleDiscard} variant="danger" />
          <ActionButton label={primaryActionLabel} onPress={handlePrimaryAction} />
        </View>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    gap: 16,
  },
  bodyText: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 22,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricTile: {
    minWidth: 150,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  uploadActionRow: {
    marginTop: 12,
  },
});
