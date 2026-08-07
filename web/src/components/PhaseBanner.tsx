import { AnimatePresence, motion } from 'framer-motion'
import type { GamePhase } from '@total-tossup-live/shared'
import { CountdownBar } from './CountdownBar'

const PHASE_LABEL: Partial<Record<GamePhase, string>> = {
  round_resolved: 'Round decided!',
  night_won: 'Night complete!',
  week_won: 'Week complete!',
}

interface PhaseBannerProps {
  phase: GamePhase
  /** 0..1, from usePhaseProgress — drains as the pause runs out. */
  progress: number
}

export function PhaseBanner({ phase, progress }: PhaseBannerProps) {
  const label = PHASE_LABEL[phase]

  return (
    <div className="flex h-16 flex-col items-center justify-center gap-2">
      <AnimatePresence mode="wait">
        {label && (
          <motion.div
            key={phase}
            className="flex flex-col items-center gap-2"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.25 }}
          >
            <p className="text-lg font-semibold text-neutral-100">{label}</p>
            <div className="w-48">
              <CountdownBar progress={progress} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
