import { motion } from 'framer-motion'
import type { Flip, GamePhase } from '@total-tossup-live/shared'

interface CoinFlipProps {
  phase: GamePhase
  phaseDurationMs: number
  flipKey: number
  lastFlip: Flip | null
}

export function CoinFlip({ phase, phaseDurationMs, flipKey, lastFlip }: CoinFlipProps) {
  const isFlipping = phase === 'flipping'

  return (
    <div className="flex flex-col items-center gap-3">
      <motion.div
        key={isFlipping ? `flipping-${flipKey}` : 'resting'}
        className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-fg bg-bg text-3xl font-bold text-fg shadow-md sm:h-28 sm:w-28"
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
      <p className="font-body text-sm text-fg">
        {isFlipping
          ? 'flipping…'
          : lastFlip
            ? `${lastFlip.face} → ${lastFlip.winner}`
            : 'waiting for the next flip'}
      </p>
    </div>
  )
}
