import { useEffect, useState } from 'react';

/**
 * Renders "how far into the current phase are we" purely from the server's
 * absolute timestamps plus the local clock — never from message arrival
 * timing. This is what lets a brand-new viewer or a reconnecting one land
 * in sync with everyone else instantly, and what keeps the coin-flip/pause
 * countdown animations correct regardless of network jitter.
 */
export function usePhaseProgress(phaseStartedAt: number, phaseEndsAt: number): number {
  const [progress, setProgress] = useState(() => computeProgress(phaseStartedAt, phaseEndsAt));

  useEffect(() => {
    let raf: number;

    function tick() {
      const value = computeProgress(phaseStartedAt, phaseEndsAt);
      setProgress(value);
      if (value < 1) {
        raf = requestAnimationFrame(tick);
      }
    }

    tick();
    return () => cancelAnimationFrame(raf);
  }, [phaseStartedAt, phaseEndsAt]);

  return progress;
}

function computeProgress(phaseStartedAt: number, phaseEndsAt: number): number {
  const total = phaseEndsAt - phaseStartedAt;
  if (total <= 0) return 1;
  const elapsed = Date.now() - phaseStartedAt;
  return Math.min(1, Math.max(0, elapsed / total));
}
