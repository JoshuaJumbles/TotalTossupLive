import { AnimatePresence, motion } from 'framer-motion';
import type { GamePhase } from '@total-tossup-live/shared';

const PHASE_LABEL: Partial<Record<GamePhase, string>> = {
  round_resolved: 'Round decided!',
  night_won: 'Night complete!',
  week_won: 'Week complete!',
  season_won: 'Season complete!',
};

interface PhaseBannerProps {
  phase: GamePhase;
  /** 0..1, from usePhaseProgress — drains as the pause runs out. */
  progress: number;
}

export function PhaseBanner({ phase, progress }: PhaseBannerProps) {
  const label = PHASE_LABEL[phase];

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
            <div className="h-1 w-48 overflow-hidden rounded-full bg-neutral-800">
              <motion.div
                className="h-full bg-amber-400"
                animate={{ width: `${(1 - progress) * 100}%` }}
                transition={{ duration: 0.1, ease: 'linear' }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
