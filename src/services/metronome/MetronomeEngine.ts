import { useDeviceConnectionStore } from '../../store/deviceConnectionStore';
import { useTrainingSessionStore } from '../../store/trainingSessionStore';
import { useUserProfileStore } from '../../store/userProfileStore';
import { BIKE_SIGNAL_STALE_TIMEOUT_MS, type BikeMetrics } from '../ble/BikeAdapter';
import { resolveHrReading, type HrReading } from '../hr/hrSource';
import { getEffectiveHrSource } from '../hr/useEffectiveHrSource';
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
      lastBikeSignalAtMs,
      latestBluetoothHr,
      lastBluetoothHrSampleAtMs,
      latestAppleWatchHr,
      latestAppleWatchActiveKcal,
      lastAppleWatchSampleAtMs,
    } = useDeviceConnectionStore.getState();

    const effectiveSource = getEffectiveHrSource();

    const nowMs = Date.now();
    const reading = resolveHrReading({
      activeSource: effectiveSource,
      latestAppleWatchHr,
      lastAppleWatchSampleAtMs,
      latestBluetoothHr,
      lastBluetoothHrSampleAtMs,
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

    const merged = this.mergeMetrics(
      this.resolveBikePower(latestBikeMetrics, lastBikeSignalAtMs, nowMs),
      latestBikeMetrics,
      reading,
      effectiveWatchKcal,
      keytelInputs,
    );
    useTrainingSessionStore.getState().tick(merged);
  }

  /**
   * The usable instantaneous power for this tick, or null when there is none.
   *
   * Two distinct ways to have no reading, both of which must NOT be reported as
   * 0 W (a valid reading from a coasting rider):
   *  - the machine never reports Instantaneous Power (FTMS flag bit 6 clear),
   *    so `BikeMetrics.power` is absent. Such a bike is supported, and its own
   *    reported energy is the correct calorie source for it;
   *  - the bike stopped notifying. A BLE stall does not always raise a
   *    disconnect, so the last packet would otherwise be integrated forever.
   */
  private resolveBikePower(
    bikeMetrics: BikeMetrics | null,
    lastBikeSignalAtMs: number | null,
    nowMs: number,
  ): number | null {
    if (bikeMetrics?.power === undefined) {
      return null;
    }
    if (lastBikeSignalAtMs === null || nowMs - lastBikeSignalAtMs > BIKE_SIGNAL_STALE_TIMEOUT_MS) {
      return null;
    }
    return bikeMetrics.power;
  }

  /**
   * Merge raw device readings into a single training tick input.
   *
   * HR comes pre-resolved by {@link resolveHrReading} — the locked source has
   * already been applied. This method handles calorie-source metadata and bike
   * field defaults only.
   *
   *  - **HR**: taken from the resolved {@link HrReading}.
   *  - **Calories**: the store decides between watch-, Keytel-, power-, and
   *    bike-sourced calories using the metadata returned here. The power tier
   *    is gated on `hasBikePower` (a live power reading exists this tick), not
   *    on HR liveness.
   *  - **All other fields**: taken directly from bike metrics.
   */
  private mergeMetrics(
    bikePower: number | null,
    bikeMetrics: BikeMetrics | null,
    hrReading: HrReading,
    watchActiveKcal: number | null,
    keytelInputs: TrainingTickInput['keytelInputs'],
  ): TrainingTickInput {
    const speed = bikeMetrics?.speed ?? 0;
    const cadence = bikeMetrics?.cadence ?? 0;
    const resistance = bikeMetrics?.resistance ?? null;
    const distance = bikeMetrics?.distance ?? null;
    const bikeTotalEnergyKcal = bikeMetrics?.totalEnergyKcal ?? null;
    // `MetricSnapshot.power` is a plain number shared with DB persistence, TCX
    // export and the dashboard, so "no reading" still renders as 0 there. The
    // flag is what carries the absence to the calorie tiers.
    const power = bikePower ?? 0;
    const hasBikePower = bikePower !== null;

    const heartRate = hrReading.bpm;
    // External HR is live when the resolved source (Apple Watch or a Bluetooth
    // strap) has a fresh signal. A null source has live === false.
    const hasLiveExternalHr = hrReading.live;

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
      hasBikePower,
      keytelInputs,
    };
  }
}
