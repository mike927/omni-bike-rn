import { TrainingPhase } from '../../../types/training';
import { formatDuration, formatMetricValue } from '../../../ui/formatters';

/**
 * Pure view-model for the Training Dashboard (Calm Noir · Direction D).
 * Maps raw session + device state into render-ready labels so the screen
 * component stays thin and the state machine is unit-testable.
 */

export type TrainingControls =
  | { readonly kind: 'idle'; readonly startDisabled: boolean }
  | { readonly kind: 'active' }
  | { readonly kind: 'paused'; readonly resumeDisabled: boolean };

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
