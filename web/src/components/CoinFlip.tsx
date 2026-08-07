import { motion } from 'framer-motion';
import type { Flip, GamePhase } from '@total-tossup-live/shared';

interface CoinFlipProps {
  phase: GamePhase;
  phaseDurationMs: number;
  /** Changes every new flip (pendingFlip's sequenceIndex while flipping) —
   * used as a React key so the spin animation restarts cleanly each time. */
  flipKey: number;
  lastFlip: Flip | null;
}

export function CoinFlip({ phase, phaseDurationMs, flipKey, lastFlip }: CoinFlipProps) {
  const isFlipping = phase === 'flipping';

  return (
    <div className="flex flex-col items-center gap-3">
      <motion.div
        key={isFlipping ? `flipping-${flipKey}` : 'resting'}
        className="flex h-28 w-28 items-center justify-center rounded-full border-4 border-neutral-700 bg-neutral-900 text-4xl font-bold text-neutral-100 shadow-xl"
        style={{ transformStyle: 'preserve-3d' }}
        initial={isFlipping ? { rotateY: 0 } : false}
        animate={{ rotateY: isFlipping ? 1080 : 0 }}
        transition={{
          duration: isFlipping ? phaseDurationMs / 1000 : 0.4,
          ease: isFlipping ? 'linear' : 'easeOut',
        }}
      >
        {isFlipping ? '🪙' : lastFlip ? (lastFlip.face === 'heads' ? 'H' : 'T') : '—'}
      </motion.div>
      <p className="text-sm text-neutral-400">
        {isFlipping
          ? 'flipping…'
          : lastFlip
            ? `${lastFlip.face} → ${lastFlip.winner}`
            : 'waiting for the next flip'}
      </p>
    </div>
  );
}
