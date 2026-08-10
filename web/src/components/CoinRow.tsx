import type { Flip } from '@total-tossup-live/shared'
import { CoinFlipHand } from './CoinFlipHand'

interface CoinRowProps {
  /** roundSize — total slots in the row. */
  slots: number
  /** currentRound.flips — already-revealed, filled in left to right. */
  flips: Flip[]
  isFlipping: boolean
  phaseDurationMs: number
  /** pendingFlip's sequenceIndex — restarts the spin animation each flip. */
  flipKey: number
}

/** The round's flip history as a left-to-right row of coin slots — filled
 * circles for resolved flips, the Prep/Flick/Open hand sequence
 * (CoinFlipHand) for the flip in progress, empty outlines for slots not
 * yet reached. Replaces the old plain "best of 5: 2-1" text with
 * something that shows the actual sequence. */
export function CoinRow({ slots, flips, isFlipping, phaseDurationMs, flipKey }: CoinRowProps) {
  return (
    <div className="flex gap-2">
      {Array.from({ length: slots }, (_, i) => {
        const flip = flips[i]
        const isPending = i === flips.length && isFlipping

        return (
          <div
            key={i}
            className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-fg bg-bg text-sm font-bold text-fg sm:h-10 sm:w-10"
            style={{ transformStyle: 'preserve-3d' }}
          >
            {flip ? (
              flip.face === 'heads' ? (
                'H'
              ) : (
                'T'
              )
            ) : isPending ? (
              <CoinFlipHand key={flipKey} phaseDurationMs={phaseDurationMs} flipKey={flipKey} />
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
