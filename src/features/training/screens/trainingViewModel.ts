import { TrainingPhase } from '../../../types/training';
import type { SessionPersistenceStatus } from '../../../store/sessionPersistenceStore';
import { formatDuration, formatMetricValue } from '../../../ui/formatters';

/**
 * Pure view-model for the Training Dashboard (Calm Noir · Direction D).
 * Maps raw session + device state into render-ready labels so the screen
 * component stays thin and the state machine is unit-testable.
 */

export type TrainingControls =
  | { readonly kind: 'idle'; readonly startDisabled: boolean }
  | { readonly kind: 'active' }
  | { readonly kind: 'paused'; readonly resumeDisabled: boolean }
  // The session enters Finished synchronously (before finishAndDisconnect's async
  // cleanup resolves). Render a terminal "finishing" state — never a Start/Resume
  // control — so a stray Start Ride button can't appear mid-finish.
  | { readonly kind: 'finishing' };

export interface TrainingViewInput {
  readonly phase: TrainingPhase;
  readonly bikeConnected: boolean;
  readonly elapsedSeconds: number;
  readonly power: number;
  readonly heartRate: number | null;
  readonly speed: number;
  readonly cadence: number;
  readonly totalDistanceMeters: number;
  readonly totalCalories: number;
}

export interface MetricValue {
  readonly value: string;
  readonly unit: string;
}

export interface SecondaryMetric extends MetricValue {
  readonly key: string;
  readonly label: string;
}

export interface TrainingViewModel {
  readonly phaseLabel: string;
  readonly timerText: string;
  readonly controls: TrainingControls;
  readonly showCallout: boolean;
  readonly calloutBody: string;
  readonly power: MetricValue;
  readonly heart: MetricValue;
  readonly secondary: readonly SecondaryMetric[];
}

const CONNECT_TO_START =
  'Connect your saved Smart Bike or choose one in setup before you start a workout from this screen.';
const RECONNECT_TO_RESUME =
  'Reconnect your saved Smart Bike or choose one in setup before you resume this interrupted workout.';

function phaseLabel(phase: TrainingPhase): string {
  if (phase === TrainingPhase.Active || phase === TrainingPhase.Finished) return 'ACTIVE';
  if (phase === TrainingPhase.Paused) return 'PAUSED';
  return 'READY';
}

function controlsFor(phase: TrainingPhase, bikeConnected: boolean): TrainingControls {
  if (phase === TrainingPhase.Active) return { kind: 'active' };
  if (phase === TrainingPhase.Paused) return { kind: 'paused', resumeDisabled: !bikeConnected };
  if (phase === TrainingPhase.Finished) return { kind: 'finishing' };
  return { kind: 'idle', startDisabled: !bikeConnected };
}

export function deriveTrainingView(input: TrainingViewInput): TrainingViewModel {
  const { phase, bikeConnected } = input;
  const isInterruptible = phase === TrainingPhase.Idle || phase === TrainingPhase.Paused;
  const showCallout = !bikeConnected && isInterruptible;

  return {
    phaseLabel: phaseLabel(phase),
    timerText: formatDuration(input.elapsedSeconds),
    controls: controlsFor(phase, bikeConnected),
    showCallout,
    calloutBody: phase === TrainingPhase.Paused ? RECONNECT_TO_RESUME : CONNECT_TO_START,
    power: { value: String(Math.round(input.power)), unit: 'W' },
    heart: { value: formatMetricValue(input.heartRate, ''), unit: 'bpm' },
    secondary: [
      { key: 'speed', label: 'SPEED', value: input.speed.toFixed(1), unit: 'km/h' },
      { key: 'distance', label: 'DIST', value: (input.totalDistanceMeters / 1000).toFixed(1), unit: 'km' },
      { key: 'cadence', label: 'CADENCE', value: String(Math.round(input.cadence)), unit: 'rpm' },
      { key: 'calories', label: 'CAL', value: String(Math.round(input.totalCalories)), unit: 'kcal' },
    ],
  };
}

/**
 * What the screen must say about the ride's storage (audit A02).
 *
 * `unsaved` is the only one with actions: the ride is over, it is not on disk,
 * and it stays in memory until the user retries the save or discards it. The
 * other two are warnings about a ride still in progress, so the user is never
 * told a ride is being recorded when it is not.
 */
export type StorageNoticeKind = 'none' | 'atRisk' | 'droppedSamples' | 'unsaved';

export interface StorageNotice {
  readonly kind: StorageNoticeKind;
  readonly title: string;
  readonly body: string;
}

export interface StorageNoticeInput {
  readonly phase: TrainingPhase;
  readonly status: SessionPersistenceStatus;
  readonly droppedSampleCount: number;
}

const NO_NOTICE: StorageNotice = { kind: 'none', title: '', body: '' };

export function deriveStorageNotice({ phase, status, droppedSampleCount }: StorageNoticeInput): StorageNotice {
  if (status === 'unsaved') {
    return {
      kind: 'unsaved',
      title: 'Ride not saved',
      body: 'This ride is finished but could not be written to your device. Retry the save, or discard the ride.',
    };
  }

  const isRiding = phase === TrainingPhase.Active || phase === TrainingPhase.Paused;
  if (!isRiding) {
    return NO_NOTICE;
  }

  if (status === 'atRisk') {
    return {
      kind: 'atRisk',
      title: 'Not saving to this device',
      body: 'Device storage is unavailable, so this ride is only in memory. It is saved when you finish, if storage recovers. Closing the app before then loses it.',
    };
  }

  if (droppedSampleCount > 0) {
    const seconds = droppedSampleCount === 1 ? '1 second' : `${droppedSampleCount} seconds`;
    return {
      kind: 'droppedSamples',
      title: 'Some ride detail was dropped',
      body: `${seconds} of ride detail could not be written to storage. Your ride and its totals are still saved when you finish.`,
    };
  }

  return NO_NOTICE;
}
