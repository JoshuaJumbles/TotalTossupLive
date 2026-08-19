import type { CoinFace } from '@total-tossup-live/shared'
import { cellIsPossible } from '@total-tossup-live/shared'
import { maskStyle } from '../lib/maskStyle'
import { SYMBOL_PAIRS } from '../lib/symbolGrid'

interface SymbolGridProps<TIcon extends string> {
  /** Which icon goes on each pair's O side (left cell) and X side (right
   * cell), keyed by the pair's index -- a per-Sheet concern, see e.g.
   * lib/barricadeSymbols.ts's BARRICADE_ARRANGEMENT. */
  arrangement: Record<number, { o: TIcon; x: TIcon }>
  /** Icon key -> mask source (an alpha-only line-art PNG, same
   * mask-and-tint technique as TeamArt/CrossOutMark) -- rendered in the
   * live color scheme's foreground color rather than a fixed art color,
   * per Josh's own ask. */
  iconSrc: Record<TIcon, string>
  /** The current round's own flips, in order (whatever's revealed so
   * far -- a null/missing entry just means that flip hasn't landed yet).
   * Drives the narrowing-focus dim: a cell fades once a landed flip rules
   * it out, converging on the single actual result by the 4th flip.
   * Defaults to "nothing revealed yet" (every cell fully lit) for callers
   * with no round in progress. */
  revealedFaces?: readonly (CoinFace | null)[]
}

function Icon({ src, possible }: { src: string; possible: boolean }) {
  return (
    <div
      className={`h-7 w-7 shrink-0 bg-fg transition-opacity duration-300 ${possible ? 'opacity-100' : 'opacity-20'}`}
      style={maskStyle(src)}
    />
  )
}

/**
 * The Teamwork Family's shared coin-grid mechanic (see lib/symbolGrid.ts
 * for the bit math) -- 8 pairs, each holding two result icons: O (tails)
 * on the left, X (heads) on the right, matching the coin's own
 * left/bottom=O, right/top=X convention.
 *
 * Rendered as a genuine 4x4 grid (16 real grid cells, one per icon) rather
 * than 8 pair-rows each internally split -- SYMBOL_PAIRS' own column-major
 * order (pair array-index i -> pairCol=floor(i/4), pairRow=i%4) maps onto
 * grid columns pairCol*2 (O) / pairCol*2+1 (X) and grid row pairRow, so
 * the O/X divider between a pair's two icons is drawn by the exact same
 * border-r/border-b mechanism as every other grid line -- same color,
 * same weight, same layer, never a separately-styled element. That's what
 * keeps the divider visible even when a pair's label fades: the label
 * doesn't own the line, the grid does.
 *
 * The label is a pure overlay -- absolutely positioned at each pair's own
 * center point (the intersection of its O/X divider and its row's own
 * center), not a layout participant. That's what lets all 16 icons split
 * the grid evenly (a plain items-center/justify-center per cell) instead
 * of a label column pushing them apart. The label's own bg-bg patch
 * covers the divider line directly behind it, reading as an "open box"
 * cut into an otherwise-continuous grid line.
 *
 * Generic over the icon set on purpose -- the grid layout/math is fixed,
 * but which icons appear (and what they mean) is entirely a per-Sheet
 * config, passed in rather than imported here.
 */
export function SymbolGrid<TIcon extends string>({ arrangement, iconSrc, revealedFaces = [] }: SymbolGridProps<TIcon>) {
  const iconCells = Array.from({ length: 4 }).flatMap((_, row) =>
    Array.from({ length: 4 }).map((_, col) => {
      const pairCol = Math.floor(col / 2)
      const side: 'o' | 'x' = col % 2 === 0 ? 'o' : 'x'
      const pair = SYMBOL_PAIRS[pairCol * 4 + row]
      const icon = arrangement[pair.index][side]
      const possible = cellIsPossible(pair.index, side, revealedFaces)
      const borderClass = `${col !== 3 ? 'border-r' : ''} ${row !== 3 ? 'border-b' : ''} border-fg`
      return (
        <div key={`${row}-${col}`} className={`flex items-center justify-center ${borderClass}`}>
          <Icon src={iconSrc[icon]} possible={possible} />
        </div>
      )
    }),
  )

  return (
    <div className="relative grid h-full min-h-0 w-full grid-cols-4 grid-rows-4 border-2 border-fg bg-bg">
      {iconCells}
      <div className="pointer-events-none absolute inset-0">
        {SYMBOL_PAIRS.map((pair, i) => {
          const pairCol = Math.floor(i / 4)
          const pairRow = i % 4
          const oPossible = cellIsPossible(pair.index, 'o', revealedFaces)
          const xPossible = cellIsPossible(pair.index, 'x', revealedFaces)
          return (
            <span
              key={pair.index}
              className={`absolute -translate-x-1/2 -translate-y-1/2 bg-bg px-1 font-body text-xs uppercase tracking-widest text-fg transition-opacity duration-300 ${
                oPossible || xPossible ? 'opacity-100' : 'opacity-20'
              }`}
              style={{ left: `${(pairCol * 2 + 1) * 25}%`, top: `${(pairRow + 0.5) * 25}%` }}
            >
              {pair.label}
            </span>
          )
        })}
      </div>
    </div>
  )
}
