import { motion } from 'framer-motion'
import type { ContainerScore } from '@total-tossup-live/shared'

interface TensionBarProps {
  flipWins: ContainerScore
  roundWinThreshold: number
}

/**
 * Figma's TensionBar — a full-width dual-color bar showing how close each
 * side is to winning the current round. Not literal win probability (Josh's
 * own call — a simple, legible heuristic beats the real race-probability
 * math for a first pass): whoever needs FEWER additional flip-wins to reach
 * roundWinThreshold gets proportionally MORE of the bar, weighted by the
 * OPPONENT's remaining need.
 *
 * blueFraction = neededDemons / (neededHumans + neededDemons)
 *
 * Checked against Josh's own worked example: 0-0 is exactly 50/50 (equal
 * need); 1 heads/2 tails (neededHumans=2, neededDemons=1) is exactly 33%
 * blue/67% red; the winning flip (neededHumans=0) saturates to 100% blue
 * with no special-casing — it just falls out of the formula.
 *
 * Stays saturated through round_resolved for free: currentRound is
 * deliberately kept (not reset) through that pause already (see
 * bestof.ts's own comment — the same mechanism CrossOutMark relies on),
 * so reading currentRound.flipWins naturally holds the decided color until
 * startNextRound() actually clears it.
 */
export function TensionBar({ flipWins, roundWinThreshold }: TensionBarProps) {
  const neededHumans = Math.max(roundWinThreshold - flipWins.humans, 0)
  const neededDemons = Math.max(roundWinThreshold - flipWins.demons, 0)
  const total = neededHumans + neededDemons
  const blueFraction = total > 0 ? neededDemons / total : 0.5

  return (
    <div className="relative h-full w-full overflow-hidden bg-demons">
      <motion.div
        className="absolute inset-y-0 left-0 bg-humans"
        animate={{ width: `${blueFraction * 100}%` }}
        transition={{ duration: 0.5, ease: 'easeInOut' }}
      />
    </div>
  )
}
