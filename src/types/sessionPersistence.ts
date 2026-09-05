import type { MetricSnapshot } from './training';

export type PersistedSessionStatus = 'active' | 'paused' | 'finished';

/**
 * `uploading` is only ever true of an operation that is live in the current
 * process. A row left `uploading` by a process that was killed is abandoned, and
 * the app cannot tell whether the provider accepted the ride: that row becomes
 * `interrupted` and waits for a decision instead of silently retrying or failing.
 */
export type SessionUploadState = 'ready' | 'uploading' | 'interrupted' | 'uploaded' | 'failed';

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

export interface PersistedProviderUpload {
  id: string;
  sessionId: string;
  providerId: string;
  uploadState: SessionUploadState;
  externalId: string | null;
  errorMessage: string | null;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface CreateProviderUploadInput {
  sessionId: string;
  providerId: string;
}

export interface UpdateProviderUploadStateInput {
  sessionId: string;
  providerId: string;
  uploadState: SessionUploadState;
  externalId: string | null;
  errorMessage: string | null;
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
