import { useEffect, useRef, useState } from 'react';

import { TrainingPhase } from '../../../types/training';

/** Max number of recent power readings kept for the live sparkline (≈ last 60s at 1 Hz). */
const CAP = 60;

/**
 * Screen-local ring buffer of recent power readings for the Power card sparkline.
 *
 * Deliberately NOT part of the session store: it's purely a display concern, so
 * keeping it here avoids touching the carefully-tuned engine/accumulator state.
 *
 * Samples once per session tick (driven by `tick`, the session's elapsedSeconds at
 * 1 Hz) while Active, so the buffer is a true time series — a steady effort fills
 * the bars over time rather than collapsing to a single bar. Freezes while Paused;
 * clears when Idle/Finished.
 */
export function usePowerTrend(power: number, phase: TrainingPhase, tick: number): number[] {
  const [samples, setSamples] = useState<number[]>([]);
  const lastTick = useRef<number | null>(null);

  useEffect(() => {
    if (phase === TrainingPhase.Idle || phase === TrainingPhase.Finished) {
      lastTick.current = null;
      setSamples((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    if (phase !== TrainingPhase.Active) return; // Paused: keep the frozen buffer.
    if (lastTick.current === tick) return; // One sample per tick.
    lastTick.current = tick;
    setSamples((prev) => {
      const next = prev.length >= CAP ? prev.slice(prev.length - CAP + 1) : prev.slice();
      next.push(power);
      return next;
    });
  }, [tick, phase, power]);

  return samples;
}
