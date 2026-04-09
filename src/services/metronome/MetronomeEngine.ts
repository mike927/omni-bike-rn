import { useDeviceConnectionStore } from '../../store/deviceConnectionStore';
import { useTrainingSessionStore } from '../../store/trainingSessionStore';
import type { BikeMetrics } from '../ble/BikeAdapter';
import type { MetricSnapshot } from '../../types/training';

const TICK_INTERVAL_MS = 1_000;

/**
 * 1 Hz engine that merges raw device readings into a unified
 * {@link MetricSnapshot} and pushes it to the training session store.
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
    const { latestBikeMetrics, latestBluetoothHr, latestAppleWatchHr } = useDeviceConnectionStore.getState();
    const merged = this.mergeMetrics(latestBikeMetrics, latestBluetoothHr, latestAppleWatchHr);
    useTrainingSessionStore.getState().tick(merged);
  }

  /**
   * Merge raw device readings into a single {@link MetricSnapshot}.
   *
   * Priority rules:
   *  - **HR**: Apple Watch > Bluetooth HR source > bike's built-in HR.
   *  - **Calories**: Currently estimated from power in the store's `tick()`.
   *            Future: Watch/bike-reported calories can override the estimate.
   *  - **All other fields**: taken directly from bike metrics.
   */
  private mergeMetrics(
    bikeMetrics: BikeMetrics | null,
    bluetoothHr: number | null,
    appleWatchHr: number | null,
  ): MetricSnapshot {
    const speed = bikeMetrics?.speed ?? 0;
    const cadence = bikeMetrics?.cadence ?? 0;
    const power = bikeMetrics?.power ?? 0;
    const resistance = bikeMetrics?.resistance ?? null;
    const distance = bikeMetrics?.distance ?? null;

    // HR priority: Apple Watch > Bluetooth HR source > bike built-in sensor
    const heartRate = appleWatchHr ?? bluetoothHr ?? bikeMetrics?.heartRate ?? null;

    return { speed, cadence, power, heartRate, resistance, distance };
  }
}
