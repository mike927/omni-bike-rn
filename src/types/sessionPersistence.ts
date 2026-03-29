import type { MetricSnapshot } from './training';

export type PersistedSessionStatus = 'active' | 'paused' | 'finished';

export type SessionUploadState = 'ready' | 'uploading' | 'uploaded' | 'failed';

export interface PersistedDeviceSnapshot {
  id: string;
  name: string;
}

export interface PersistedTrainingSummary {
  elapsedSeconds: number;
  totalDistanceMeters: number;
  totalCaloriesKcal: number;
  currentMetrics: MetricSnapshot;
}

export interface PersistedTrainingSession extends PersistedTrainingSummary {
  id: string;
  status: PersistedSessionStatus;
  startedAtMs: number;
  endedAtMs: number | null;
  savedBikeSnapshot: PersistedDeviceSnapshot | null;
  savedHrSnapshot: PersistedDeviceSnapshot | null;
  uploadState: SessionUploadState | null;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface PersistedTrainingSample {
  id: string;
  sessionId: string;
  sequence: number;
  recordedAtMs: number;
  elapsedSeconds: number;
  metrics: MetricSnapshot;
}

export interface PersistedTrainingSessionRow {
  id: string;
  status: PersistedSessionStatus;
  startedAtMs: number;
  endedAtMs: number | null;
  elapsedSeconds: number;
  totalDistanceMeters: number;
  totalCaloriesKcal: number;
  currentSpeedKmh: number;
  currentCadenceRpm: number;
  currentPowerWatts: number;
  currentHeartRateBpm: number | null;
  currentResistanceLevel: number | null;
  currentDistanceMeters: number | null;
  savedBikeId: string | null;
  savedBikeName: string | null;
  savedHrId: string | null;
  savedHrName: string | null;
  uploadState: SessionUploadState | null;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface CreateDraftSessionInput extends PersistedTrainingSummary {
  sessionId: string;
  startedAtMs: number;
  savedBikeSnapshot: PersistedDeviceSnapshot | null;
  savedHrSnapshot: PersistedDeviceSnapshot | null;
}

export interface AppendSampleInput extends PersistedTrainingSummary {
  sessionId: string;
  sampleId: string;
  sequence: number;
  recordedAtMs: number;
}

export interface UpdateSessionStatusInput {
  sessionId: string;
  status: Exclude<PersistedSessionStatus, 'finished'>;
  updatedAtMs: number;
}

export interface FinalizeSessionInput extends PersistedTrainingSummary {
  sessionId: string;
  endedAtMs: number;
  updatedAtMs: number;
}
