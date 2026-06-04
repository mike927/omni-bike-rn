import { TrainingPhase } from '../../../../types/training';
import { deriveTrainingView, type TrainingViewInput } from '../trainingViewModel';

const base: TrainingViewInput = {
  phase: TrainingPhase.Idle,
  bikeConnected: true,
  elapsedSeconds: 0,
  power: 0,
  heartRate: null,
  speed: 0,
  cadence: 0,
  totalDistanceMeters: 0,
  totalCalories: 0,
};

describe('deriveTrainingView — phase labels & controls', () => {
  it('idle + bike connected → READY, enabled Start, no callout', () => {
    const vm = deriveTrainingView({ ...base, phase: TrainingPhase.Idle, bikeConnected: true });
    expect(vm.phaseLabel).toBe('READY');
    expect(vm.controls).toEqual({ kind: 'idle', startDisabled: false });
    expect(vm.showCallout).toBe(false);
  });

  it('idle + bike disconnected → Start disabled, callout about starting', () => {
    const vm = deriveTrainingView({ ...base, phase: TrainingPhase.Idle, bikeConnected: false });
    expect(vm.controls).toEqual({ kind: 'idle', startDisabled: true });
    expect(vm.showCallout).toBe(true);
    expect(vm.calloutBody).toContain('start a workout');
  });

  it('active → ACTIVE, pause/finish controls, never shows callout', () => {
    const vm = deriveTrainingView({ ...base, phase: TrainingPhase.Active, bikeConnected: false });
    expect(vm.phaseLabel).toBe('ACTIVE');
    expect(vm.controls).toEqual({ kind: 'active' });
    expect(vm.showCallout).toBe(false);
  });

  it('paused + bike connected → PAUSED, Resume enabled, no callout', () => {
    const vm = deriveTrainingView({ ...base, phase: TrainingPhase.Paused, bikeConnected: true });
    expect(vm.phaseLabel).toBe('PAUSED');
    expect(vm.controls).toEqual({ kind: 'paused', resumeDisabled: false });
    expect(vm.showCallout).toBe(false);
  });

  it('paused + bike disconnected → Resume disabled, callout about resuming', () => {
    const vm = deriveTrainingView({ ...base, phase: TrainingPhase.Paused, bikeConnected: false });
    expect(vm.controls).toEqual({ kind: 'paused', resumeDisabled: true });
    expect(vm.showCallout).toBe(true);
    expect(vm.calloutBody).toContain('resume');
  });

  it('finished → finishing controls, never the idle/start fallthrough', () => {
    const vm = deriveTrainingView({ ...base, phase: TrainingPhase.Finished, bikeConnected: true });
    expect(vm.controls).toEqual({ kind: 'finishing' });
    expect(vm.showCallout).toBe(false);
  });
});

describe('deriveTrainingView — metric formatting', () => {
  const live: TrainingViewInput = {
    phase: TrainingPhase.Active,
    bikeConnected: true,
    elapsedSeconds: 24 * 60 + 18,
    power: 248,
    heartRate: 152,
    speed: 31.4,
    cadence: 92,
    totalDistanceMeters: 12_600,
    totalCalories: 318,
  };

  it('formats the timer as mm:ss within an hour', () => {
    expect(deriveTrainingView(live).timerText).toBe('00:24:18');
  });

  it('power hero card', () => {
    expect(deriveTrainingView(live).power).toEqual({ value: '248', unit: 'W' });
  });

  it('heart rate shows the number when present', () => {
    expect(deriveTrainingView(live).heart).toEqual({ value: '152', unit: 'bpm' });
  });

  it('heart rate shows -- when null', () => {
    expect(deriveTrainingView({ ...live, heartRate: null }).heart.value).toBe('--');
  });

  it('secondary metrics: speed, distance, cadence, calories', () => {
    const { secondary } = deriveTrainingView(live);
    expect(secondary.map((m) => [m.label, m.value, m.unit])).toEqual([
      ['SPEED', '31.4', 'km/h'],
      ['DIST', '12.6', 'km'],
      ['CADENCE', '92', 'rpm'],
      ['CAL', '318', 'kcal'],
    ]);
  });
});
