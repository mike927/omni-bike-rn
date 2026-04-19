import { useDeviceConnectionStore } from '../../store/deviceConnectionStore';
import { useTrainingSessionStore } from '../../store/trainingSessionStore';
import type { BikeMetrics } from '../ble/BikeAdapter';
import type { MetricSnapshot, TrainingTickInput } from '../../types/training';

const TICK_INTERVAL_MS = 1_000;

/**
 * 1 Hz engine that merges raw device readings into a unified
 * {@link MetricSnapshot} plus calorie-source metadata and pushes it to the
 * training session store.
 *
 * This is a plain class — not a React hook — so it runs independently
 * of the component tree and can be started/stopped from any hook or service.
 *
 * **Extensibility**: The {@link mergeMetrics} method applies source-priority
 * logic (e.g. external HR > bike HR). Adding a new sensor (Apple Watch,
 * power meter, etc.) means reading one more field from
 * {@link useDeviceConnectionStore} and adding a priority rule here.
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
    const { latestBikeMetrics, latestBluetoothHr, latestAppleWatchHr, latestAppleWatchActiveKcal } =
      useDeviceConnectionStore.getState();
    const merged = this.mergeMetrics(
      latestBikeMetrics,
      latestBluetoothHr,
      latestAppleWatchHr,
      latestAppleWatchActiveKcal,
    );
    useTrainingSessionStore.getState().tick(merged);
  }

  /**
   * Merge raw device readings into a single training tick input.
   *
   * Priority rules:
   *  - **HR**: Apple Watch > Bluetooth HR source > bike's built-in HR.
   *  - **Calories**: the store decides between watch-, app-, and bike-sourced
   *    calories using the metadata returned here.
   *  - **All other fields**: taken directly from bike metrics.
   */
  private mergeMetrics(
    bikeMetrics: BikeMetrics | null,
    bluetoothHr: number | null,
    appleWatchHr: number | null,
    watchActiveKcal: number | null,
  ): TrainingTickInput {
    const speed = bikeMetrics?.speed ?? 0;
    const cadence = bikeMetrics?.cadence ?? 0;
    const power = bikeMetrics?.power ?? 0;
    const resistance = bikeMetrics?.resistance ?? null;
    const distance = bikeMetrics?.distance ?? null;
    const bikeTotalEnergyKcal = bikeMetrics?.totalEnergyKcal ?? null;

    // HR priority: Apple Watch > Bluetooth HR source > bike built-in sensor
    const heartRate = appleWatchHr ?? bluetoothHr ?? bikeMetrics?.heartRate ?? null;
    const hasLiveExternalHr = appleWatchHr !== null || bluetoothHr !== null;

    return {
      metrics: { speed, cadence, power, heartRate, resistance, distance } satisfies MetricSnapshot,
      bikeTotalEnergyKcal,
      watchActiveKcal,
      hasLiveExternalHr,
    };
  }
}
