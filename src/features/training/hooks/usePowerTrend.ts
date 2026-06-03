import { useEffect, useRef, useState } from 'react';

import { TrainingPhase } from '../../../types/training';

/** Max number of recent power readings kept for the live sparkline. */
const CAP = 60;

/**
 * Screen-local ring buffer of recent power readings for the Power card sparkline.
 *
 * Deliberately NOT part of the session store: it's purely a display concern, so
 * keeping it here avoids touching the carefully-tuned engine/accumulator state.
 * Pushes a sample whenever power changes while Active; freezes while Paused;
 * clears when Idle/Finished.
 */
export function usePowerTrend(power: number, phase: TrainingPhase): number[] {
  const [samples, setSamples] = useState<number[]>([]);
  const lastPower = useRef<number | null>(null);

  useEffect(() => {
    if (phase === TrainingPhase.Idle || phase === TrainingPhase.Finished) {
      lastPower.current = null;
      setSamples((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    if (phase !== TrainingPhase.Active) return; // Paused: keep the frozen buffer.
    if (lastPower.current === power) return;
    lastPower.current = power;
    setSamples((prev) => {
      const next = prev.length >= CAP ? prev.slice(prev.length - CAP + 1) : prev.slice();
      next.push(power);
      return next;
    });
  }, [power, phase]);

  return samples;
}
