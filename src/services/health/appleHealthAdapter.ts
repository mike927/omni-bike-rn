import {
  AppleHealthWorkout,
  isAppleHealthWorkoutAvailable,
  type CyclingQuantitySampleInput,
  type HeartRateSampleInput,
} from 'apple-health-workout';
import {
  appendAppleHealthDiagnostic,
  getAppleHealthDiagnosticsRelativePath,
} from '../diagnostics/appleHealthDiagnostics';
import { basalKcalForWindow } from '../calories/mifflinStJeor';
import { impliedActiveSeconds, toWorkoutEvents } from './workoutPauseEvents';
import type { PersistedTrainingSample, PersistedTrainingSession } from '../../types/sessionPersistence';
import { toMifflinInputs, type BiologicalSex, type UserProfileField } from '../../types/userProfile';
import { useUserProfileStore } from '../../store/userProfileStore';

interface HealthKitErrorObject {
  message?: string;
  code?: number | string;
  domain?: string;
  userInfo?: Record<string, unknown>;
  nativeStackIOS?: string[];
}

type HealthKitErrorLike = HealthKitErrorObject | string | null | undefined;

function assertAppleHealthAvailable(): void {
  if (!isAppleHealthWorkoutAvailable) {
    throw new Error('Apple Health is only available on iOS.');
  }
}

function formatHealthKitErrorMessage(error: HealthKitErrorLike, fallbackMessage: string): string {
  if (!error) {
    return fallbackMessage;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (typeof error.message === 'string' && error.message.length > 0) {
    return error.message;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return fallbackMessage;
  }
}

function normalizeHealthKitError(error: unknown, fallbackMessage: string): Error {
  if (error instanceof Error) {
    return error;
  }

  const normalizedError = new Error(formatHealthKitErrorMessage(error as HealthKitErrorLike, fallbackMessage));

  if (error && typeof error === 'object') {
    Object.assign(normalizedError, { details: error });
  }

  return normalizedError;
}

const HEALTHKIT_STATUS_LABELS = ['NotDetermined', 'SharingDenied', 'SharingAuthorized'] as const;

function logHealthKitAuthorizationStatus(context: string): void {
  if (!__DEV__) {
    return;
  }

  try {
    const raw = AppleHealthWorkout.getWriteAuthorizationStatus();
    const writeStatuses = Object.fromEntries(
      Object.entries(raw).map(([identifier, code]) => [
        identifier,
        HEALTHKIT_STATUS_LABELS[code] ?? `Unknown(${code})`,
      ]),
    );
    appendAppleHealthDiagnostic('auth-status', {
      context,
      writeStatuses,
      raw,
      diagnosticsFile: getAppleHealthDiagnosticsRelativePath(),
    });
    console.warn('[appleHealthAdapter] HealthKit authorization status', { context, writeStatuses, raw });
  } catch (error: unknown) {
    appendAppleHealthDiagnostic('auth-status-read-failed', { context, error });
    console.warn('[appleHealthAdapter] Failed to read HealthKit authorization status', { context, error });
  }
}

async function requestHealthKitAuthorization(): Promise<void> {
  appendAppleHealthDiagnostic('requestAuthorization-payload', {
    diagnosticsFile: getAppleHealthDiagnosticsRelativePath(),
  });

  try {
    await AppleHealthWorkout.requestHealthKitAuthorization();
    appendAppleHealthDiagnostic('requestAuthorization-success', {});
    logHealthKitAuthorizationStatus('after-init');
  } catch (error: unknown) {
    appendAppleHealthDiagnostic('requestAuthorization-error', { error });
    throw normalizeHealthKitError(error, 'Failed to authorize Apple Health.');
  }
}

// Memoize a single in-flight init promise so the launch-time permission
// refresh hook and the profile auto-sync hook can both await initialization
// without firing duplicate iOS authorization prompts. Cleared on failure so
// subsequent attempts can retry.
let initPromise: Promise<void> | null = null;

export async function initWithWritePermissions(): Promise<void> {
  assertAppleHealthAvailable();
  if (initPromise) return initPromise;
  initPromise = requestHealthKitAuthorization().catch((error: unknown) => {
    initPromise = null;
    throw error;
  });
  return initPromise;
}

// Test seam: reset the memoized init promise so each test starts from a
// known state.
export function __resetHealthKitInitPromiseForTests(): void {
  initPromise = null;
}

export interface SaveWorkoutResult {
  workoutId: string;
}

// km/h → m/s conversion factor for cyclingSpeed samples. HealthKit's canonical
// unit for `cyclingSpeed` is m/s; our bike ticks report speed in km/h.
const KMH_TO_MPS = 1 / 3.6;

function mapHeartRateSamples(samples: PersistedTrainingSample[]): HeartRateSampleInput[] {
  const mapped: HeartRateSampleInput[] = [];
  for (const sample of samples) {
    const bpm = sample.metrics.heartRate;
    if (typeof bpm === 'number' && bpm > 0) {
      mapped.push({ bpm, timestampMs: sample.recordedAtMs });
    }
  }
  return mapped;
}

function mapCyclingSamples(
  samples: PersistedTrainingSample[],
  extract: (metrics: PersistedTrainingSample['metrics']) => number,
): CyclingQuantitySampleInput[] {
  const mapped: CyclingQuantitySampleInput[] = [];
  for (const sample of samples) {
    const value = extract(sample.metrics);
    if (Number.isFinite(value) && value >= 0) {
      mapped.push({ value, timestampMs: sample.recordedAtMs });
    }
  }
  return mapped;
}

/**
 * Sums HealthKit `basalEnergyBurned` for the workout interval via the native
 * module, which filters out this app's own prior basal writes so a re-export
 * doesn't compound. Returns 0 on any failure — the native save then skips
 * emitting the Basal sample and Apple Fitness renders Active = Total, matching
 * pre-split behavior.
 */
async function queryBasalEnergyKcal(startedAtMs: number, endedAtMs: number): Promise<number> {
  const options = {
    startDate: new Date(startedAtMs).toISOString(),
    endDate: new Date(endedAtMs).toISOString(),
  };
  try {
    const kcal = await AppleHealthWorkout.queryBasalEnergyKcal(options);
    appendAppleHealthDiagnostic('basalEnergy-query-success', { options, totalKcal: kcal });
    return Number.isFinite(kcal) && kcal > 0 ? kcal : 0;
  } catch (error: unknown) {
    appendAppleHealthDiagnostic('basalEnergy-query-error', { error, options });
    return 0;
  }
}

interface ResolveBasalArgs {
  queriedBasalKcal: number;
  durationSeconds: number;
}

/**
 * Picks the basal kcal value for the workout. HealthKit is the source of truth
 * when it returns a positive number; when it returns 0 (no samples for the
 * window) we fall back to a Mifflin–St Jeor estimate computed from the user
 * profile so Apple Fitness still renders a real Resting figure. With no
 * profile, we pass through 0 — Apple Fitness falls back to Active = Total,
 * which matches pre-fallback behaviour.
 */
function resolveBasalKcal({ queriedBasalKcal, durationSeconds }: ResolveBasalArgs): number {
  if (queriedBasalKcal > 0) return queriedBasalKcal;
  if (durationSeconds <= 0) return 0;
  const profile = useUserProfileStore.getState().profile;
  const mifflinInputs = toMifflinInputs(profile);
  if (mifflinInputs === null) return 0;
  const estimate = basalKcalForWindow(mifflinInputs, durationSeconds);
  appendAppleHealthDiagnostic('basalEnergy-mifflin-fallback', { estimate, durationSeconds });
  return estimate;
}

export async function saveWorkout(
  session: PersistedTrainingSession,
  samples: PersistedTrainingSample[],
): Promise<SaveWorkoutResult> {
  assertAppleHealthAvailable();
  const startDate = new Date(session.startedAtMs).toISOString();
  const endDateMs = session.endedAtMs ?? session.startedAtMs + session.elapsedSeconds * 1000;
  const endDate = new Date(endDateMs).toISOString();
  const heartRateSamples = mapHeartRateSamples(samples);
  const cyclingPowerSamples = mapCyclingSamples(samples, (m) => m.power);
  const cyclingCadenceSamples = mapCyclingSamples(samples, (m) => m.cadence);
  const cyclingSpeedSamples = mapCyclingSamples(samples, (m) => m.speed * KMH_TO_MPS);
  // The workout keeps its real start and end; the pause events are what tell
  // HealthKit which parts of that window were not effort. See
  // `toWorkoutEvents` for why an old ride without a pause history stays whole.
  const workoutEvents = toWorkoutEvents(session.pauseEvents, session.startedAtMs, endDateMs);
  const queriedBasalKcal = await queryBasalEnergyKcal(session.startedAtMs, endDateMs);
  const basalEnergyKcal = resolveBasalKcal({
    queriedBasalKcal,
    durationSeconds: Math.max(0, (endDateMs - session.startedAtMs) / 1000),
  });

  try {
    const workoutId = await AppleHealthWorkout.saveCyclingWorkout({
      startDate,
      endDate,
      activeEnergyKcal: session.totalCaloriesKcal,
      basalEnergyKcal,
      totalDistanceMeters: session.totalDistanceMeters,
      heartRateSamples,
      cyclingPowerSamples,
      cyclingCadenceSamples,
      cyclingSpeedSamples,
      workoutEvents,
    });
    appendAppleHealthDiagnostic('saveWorkout-success', {
      workoutId,
      startDate,
      endDate,
      activeEnergyKcal: session.totalCaloriesKcal,
      basalEnergyKcal,
      distanceMeters: session.totalDistanceMeters,
      hrSampleCount: heartRateSamples.length,
      powerSampleCount: cyclingPowerSamples.length,
      cadenceSampleCount: cyclingCadenceSamples.length,
      speedSampleCount: cyclingSpeedSamples.length,
      workoutEvents,
      // What HealthKit should report as the workout's duration, next to what the
      // app recorded, so a device check can compare the two without arithmetic.
      impliedActiveSeconds: impliedActiveSeconds(workoutEvents, session.startedAtMs, endDateMs),
      recordedElapsedSeconds: session.elapsedSeconds,
    });
    return { workoutId };
  } catch (error: unknown) {
    appendAppleHealthDiagnostic('saveWorkout-error', {
      error,
      startDate,
      endDate,
      activeEnergyKcal: session.totalCaloriesKcal,
      basalEnergyKcal,
      distanceMeters: session.totalDistanceMeters,
      hrSampleCount: heartRateSamples.length,
      powerSampleCount: cyclingPowerSamples.length,
      cadenceSampleCount: cyclingCadenceSamples.length,
      speedSampleCount: cyclingSpeedSamples.length,
      workoutEvents,
    });
    throw normalizeHealthKitError(error, 'Failed to save Apple Health workout.');
  }
}

export type AppleHealthProfilePartial = Partial<{
  [F in UserProfileField]: F extends 'sex' ? BiologicalSex : F extends 'dateOfBirth' ? string : number;
}>;

async function readHealthValue<R>(query: () => Promise<R>): Promise<R | null> {
  try {
    return await query();
  } catch {
    return null;
  }
}

export async function getBiologicalSex(): Promise<BiologicalSex | null> {
  const sex = await readHealthValue(() => AppleHealthWorkout.getBiologicalSex());
  return sex === 'male' || sex === 'female' ? sex : null;
}

export async function getDateOfBirth(): Promise<string | null> {
  const date = await readHealthValue(() => AppleHealthWorkout.getDateOfBirth());
  return typeof date === 'string' && date.length > 0 ? date.slice(0, 10) : null;
}

export async function getLatestWeightKg(): Promise<number | null> {
  const weight = await readHealthValue(() => AppleHealthWorkout.getLatestWeightKg());
  return typeof weight === 'number' && Number.isFinite(weight) && weight > 0 ? weight : null;
}

export async function getLatestHeightCm(): Promise<number | null> {
  const height = await readHealthValue(() => AppleHealthWorkout.getLatestHeightCm());
  return typeof height === 'number' && Number.isFinite(height) && height > 0 ? height : null;
}

export async function loadProfileFromAppleHealth(): Promise<AppleHealthProfilePartial> {
  assertAppleHealthAvailable();
  // Block on init so the four characteristic-type reads don't run before iOS
  // has prompted for the new Sex / DOB / Weight / Height read permissions.
  // Without this, on app upgrade the auto-sync runs to completion before the
  // user has a chance to grant the new types and silently returns no fields.
  await initWithWritePermissions();
  const [sex, dateOfBirth, weightKg, heightCm] = await Promise.all([
    getBiologicalSex(),
    getDateOfBirth(),
    getLatestWeightKg(),
    getLatestHeightCm(),
  ]);
  const partial: AppleHealthProfilePartial = {};
  if (sex !== null) partial.sex = sex;
  if (dateOfBirth !== null) partial.dateOfBirth = dateOfBirth;
  if (weightKg !== null) partial.weightKg = weightKg;
  if (heightCm !== null) partial.heightCm = heightCm;
  return partial;
}
