import type { Flip } from '@total-tossup-live/shared'
import { CoinIdle, CoinResult, CoinFlipHand } from './CoinDisplay'

interface CoinRowProps {
  /** roundSize — total slots in the row. */
  slots: number
  /** currentRound.flips — already-revealed, filled in left to right. */
  flips: Flip[]
  isFlipping: boolean
  phaseDurationMs: number
  /** pendingFlip's sequenceIndex — restarts the flip sequence each flip. */
  flipKey: number
}

/** The round's flip history as 5 equal-width columns, each filling
 * CoinFrame's full height — Josh's CoinDisplaySet reference in Figma.
 * Resolved flips show CoinResult, the flip in progress runs the full
 * CoinFlipHand sequence, slots not yet reached show CoinIdle (the
 * resting, unflipped coin) rather than nothing. Replaces the old plain
 * "best of 5: 2-1" text with something that shows the actual sequence. */
export function CoinRow({ slots, flips, isFlipping, phaseDurationMs, flipKey }: CoinRowProps) {
  return (
    <div className="flex h-full w-full">
      {Array.from({ length: slots }, (_, i) => {
        const flip = flips[i]
        const isPending = i === flips.length && isFlipping

        return (
          <div key={i} className="relative h-full flex-1">
            {flip ? (
              <CoinResult face={flip.face!} />
            ) : isPending ? (
              <CoinFlipHand key={flipKey} phaseDurationMs={phaseDurationMs} />
            ) : (
              <CoinIdle />
            )}
          </div>
        )
      })}
    </div>
  )
}
