import { useDeviceConnectionStore } from '../../store/deviceConnectionStore';
import { useHrSourceStore } from '../../store/hrSourceStore';
import { useSavedGearStore } from '../../store/savedGearStore';
import { useTrainingSessionStore } from '../../store/trainingSessionStore';
import { useUserProfileStore } from '../../store/userProfileStore';
import type { BikeMetrics } from '../ble/BikeAdapter';
import { resolveEffectiveHrSource, resolveHrReading, type HrReading } from '../hr/hrSource';
import type { MetricSnapshot, TrainingTickInput } from '../../types/training';
import { toKeytelInputs } from '../../types/userProfile';

const TICK_INTERVAL_MS = 1_000;

/**
 * 1 Hz engine that merges raw device readings into a unified
 * {@link MetricSnapshot} plus calorie-source metadata and pushes it to the
 * training session store.
 *
 * This is a plain class — not a React hook — so it runs independently
 * of the component tree and can be started/stopped from any hook or service.
 *
 * **Extensibility**: HR is resolved through {@link resolveHrReading} using the
 * session-locked source stored in {@link useDeviceConnectionStore}. Adding a
 * new sensor means extending {@link HrSource} and {@link resolveHrReading}.
 */
export class MetronomeEngine {
  private intervalId: ReturnType<typeof setInterval> | null = null;

  /** Start the 1 Hz loop. Double-start is a no-op. */
  start(): void {
    if (this.intervalId !== null) return;

    this.intervalId = setInterval(() => {
      this.tick();
    }, TICK_INTERVAL_MS);
  }

  /** Stop the loop and clear the interval. */
  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /** Whether the engine is currently running. */
  isRunning(): boolean {
    return this.intervalId !== null;
  }

  // ── Private ────────────────────────────────────────────

  private tick(): void {
    const {
      latestBikeMetrics,
      latestBluetoothHr,
      lastBluetoothHrSampleAtMs,
      latestAppleWatchHr,
      latestAppleWatchActiveKcal,
      lastAppleWatchSampleAtMs,
      activeHrSource,
      watchAvailability,
    } = useDeviceConnectionStore.getState();

    const { savedHrSource } = useSavedGearStore.getState();
    const { primary: primaryHrSource } = useHrSourceStore.getState();

    // Resolve the effective HR source for this tick using the shared resolver.
    // Priority: session-locked source → user-configured primary → hardware default.
    const watchSupported = watchAvailability !== 'unavailable';
    const savedHrStrapName = savedHrSource?.name ?? null;
    const effectiveSource = resolveEffectiveHrSource({
      activeHrSource,
      primaryHrSource,
      watchSupported,
      savedHrStrapName,
    });

    const nowMs = Date.now();
    const reading = resolveHrReading({
      activeSource: effectiveSource,
      latestAppleWatchHr,
      lastAppleWatchSampleAtMs,
      latestBluetoothHr,
      lastBluetoothHrSampleAtMs,
      bikeHeartRate: latestBikeMetrics?.heartRate ?? null,
      nowMs,
    });

    // Watch kcal is forwarded only while the watch reading is live — if the
    // watch stream has gone silent (reading.live is false for 'watch' source),
    // drop the stale cumulative kcal so the session falls through to app/power.
    const effectiveWatchKcal = reading.source === 'watch' && reading.live ? latestAppleWatchActiveKcal : null;

    // Profile snapshot read once per tick. Pure derivation — no store
    // mutation. Returns null when sex / DOB / weight aren't all set, in which
    // case the store falls through to the existing power-based formula.
    const keytelInputs = toKeytelInputs(useUserProfileStore.getState().profile);

    const merged = this.mergeMetrics(latestBikeMetrics, reading, effectiveWatchKcal, keytelInputs);
    useTrainingSessionStore.getState().tick(merged);
  }

  /**
   * Merge raw device readings into a single training tick input.
   *
   * HR comes pre-resolved by {@link resolveHrReading} — the locked source has
   * already been applied. This method handles calorie-source metadata and bike
   * field defaults only.
   *
   *  - **HR**: taken from the resolved {@link HrReading}.
   *  - **Calories**: the store decides between watch-, app-, and bike-sourced
   *    calories using the metadata returned here.
   *  - **All other fields**: taken directly from bike metrics.
   */
  private mergeMetrics(
    bikeMetrics: BikeMetrics | null,
    hrReading: HrReading,
    watchActiveKcal: number | null,
    keytelInputs: TrainingTickInput['keytelInputs'],
  ): TrainingTickInput {
    const speed = bikeMetrics?.speed ?? 0;
    const cadence = bikeMetrics?.cadence ?? 0;
    const power = bikeMetrics?.power ?? 0;
    const resistance = bikeMetrics?.resistance ?? null;
    const distance = bikeMetrics?.distance ?? null;
    const bikeTotalEnergyKcal = bikeMetrics?.totalEnergyKcal ?? null;

    const heartRate = hrReading.bpm;
    // External HR is live when the locked source has a fresh signal AND it is
    // not the bike's own built-in sensor (which doesn't need an external HR
    // device to produce calorie estimates).
    const hasLiveExternalHr = hrReading.live && hrReading.source !== 'bike';

    return {
      metrics: {
        speed,
        cadence,
        power,
        heartRate,
        resistance,
        distance,
      } satisfies MetricSnapshot,
      bikeTotalEnergyKcal,
      watchActiveKcal,
      hasLiveExternalHr,
      keytelInputs,
    };
  }
}
