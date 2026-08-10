import type { Side } from '@total-tossup-live/shared'
import { columnCounts, OVERLAP, STAGGER } from '../lib/unitLayout'
import humanArt from '../assets/human-simple.png'
import demonArt from '../assets/demon-simple.png'

const ART: Record<Side, string> = { humans: humanArt, demons: demonArt }

interface UnitColumnsProps {
  side: Side
  total: number
  /** Computed by useUnitIconSize — shared between both sides so humans
   * and demons render at the exact same size, not two independently
   * rounded values. */
  size: number
  crossedIndices: Set<number>
  /** Color of whoever is doing the crossing (the opponent), not this row's
   * own side — a Human unit gets crossed off in Demons' color, and vice
   * versa, matching the physical game's pen-marking convention. */
  markColorClass: string
}

/** N unit icons for one side, arranged in 1–3 columns (see columnCounts)
 * that grow toward the center and rise as they do — translating Josh's
 * Battle1-6 Sheet specs (offset, interlocking columns) into one
 * consistent, size-driven rule instead of 6 hand-placed layouts. Crossed-
 * off units still use a plain X — a proper cross-mark asset library is a
 * separate, later feature, same placeholder as before. */
export function UnitColumns({ side, total, size, crossedIndices, markColorClass }: UnitColumnsProps) {
  if (!size) return null

  const counts = columnCounts(total)
  // Column 0 is always the outer column (nearest the frame edge); demons
  // mirror the display order so "outer" reads as outer on both sides.
  const displayColumns = side === 'demons' ? [...counts.keys()].reverse() : [...counts.keys()]

  const startIndex: number[] = []
  let running = 0
  for (const count of counts) {
    startIndex.push(running)
    running += count
  }

  return (
    <div className="flex items-end">
      {displayColumns.map((logicalCol) => (
        <div
          key={logicalCol}
          className="flex flex-col items-center"
          style={{ width: size, marginBottom: logicalCol * STAGGER * size }}
        >
          {Array.from({ length: counts[logicalCol] }, (_, row) => {
            const idx = startIndex[logicalCol] + row
            return (
              <div
                key={row}
                className="relative"
                style={{ width: size, height: size, marginTop: row === 0 ? 0 : -size * OVERLAP }}
              >
                <img
                  src={ART[side]}
                  alt=""
                  className={`h-full w-full object-contain ${side === 'demons' ? 'scale-x-[-1]' : ''}`}
                />
                {crossedIndices.has(idx) && (
                  <span
                    className={`pointer-events-none absolute inset-0 flex items-center justify-center font-bold drop-shadow-[0_0_2px_var(--color-bg)] ${markColorClass}`}
                    style={{ fontSize: size * 0.5 }}
                  >
                    ✕
                  </span>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
