import type { Side } from '@total-tossup-live/shared'
import humanArt from '../assets/human-simple.png'
import demonArt from '../assets/demon-simple.png'

const ART: Record<Side, string> = { humans: humanArt, demons: demonArt }

interface UnitRowProps {
  side: Side
  total: number
  crossedIndices: Set<number>
  /** Color of whoever is doing the crossing (the opponent), not this row's
   * own side — a Human unit gets crossed off in Demons' color, and vice
   * versa, matching the physical game's pen-marking convention. */
  markColorClass: string
}

/** N unit icons for one side, with crossed-off ones marked with a plain X.
 * Placeholder art (reusing the same human/demon symbol as everywhere else)
 * and a plain glyph for the cross mark — both explicitly temporary, per
 * the design note that a varied unit set and a cross-mark asset library
 * are later, separate features. */
export function UnitRow({ side, total, crossedIndices, markColorClass }: UnitRowProps) {
  return (
    <div className="flex flex-wrap justify-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="relative h-10 w-10 sm:h-12 sm:w-12">
          <img
            src={ART[side]}
            alt=""
            className={`h-full w-full object-contain ${side === 'demons' ? 'scale-x-[-1]' : ''}`}
          />
          {crossedIndices.has(i) && (
            <span
              className={`pointer-events-none absolute inset-0 flex items-center justify-center text-2xl font-bold drop-shadow-[0_0_2px_var(--color-bg)] sm:text-3xl ${markColorClass}`}
            >
              ✕
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
