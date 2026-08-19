import type { CoinFace } from '@total-tossup-live/shared'
import { cellIsPossible } from '@total-tossup-live/shared'
import { SYMBOL_PAIRS } from '../lib/symbolGrid'

interface SymbolGridProps<TIcon extends string> {
  /** Which icon goes on each pair's O side (left cell) and X side (right
   * cell), keyed by the pair's index -- a per-Sheet concern, see e.g.
   * lib/barricadeSymbols.ts's BARRICADE_ARRANGEMENT. */
  arrangement: Record<number, { o: TIcon; x: TIcon }>
  /** Icon key -> image src, so this component never hardcodes any one
   * Sheet's icon set. */
  iconSrc: Record<TIcon, string>
  /** The current round's own flips, in order (whatever's revealed so
   * far -- a null/missing entry just means that flip hasn't landed yet).
   * Drives the narrowing-focus dim: a cell fades once a landed flip rules
   * it out, converging on the single actual result by the 4th flip.
   * Defaults to "nothing revealed yet" (every cell fully lit) for callers
   * with no round in progress. */
  revealedFaces?: readonly (CoinFace | null)[]
}

/**
 * The Teamwork Family's shared coin-grid mechanic (see lib/symbolGrid.ts
 * for the bit math) -- 8 pairs, each showing its own 3-flip label between
 * two result icons: left = O (tails), right = X (heads), matching the
 * coin's own left/bottom=O, right/top=X convention. `grid-flow-col` fills
 * column-by-column, matching SYMBOL_PAIRS' own real display order.
 *
 * Generic over the icon set on purpose -- the grid layout/math is fixed,
 * but which icons appear (and what they mean) is entirely a per-Sheet
 * config, passed in rather than imported here. Layout matches the pattern
 * established by the original barricade-board.png export (8 rows of label
 * + 2 result slots, 2 physical columns of 4) -- confirmed directly against
 * Figma's own BarricadeBoardConfig/BarricadeSymbols reference (node
 * 221:1079 / 221:1076).
 *
 * The narrowing-focus dim (Josh's own Figma reference used 4 growing
 * overlay rectangles, node 221:1147 -- see cellIsPossible's own doc
 * comment) is done per-icon here instead: each icon's own opacity is
 * computed straight from whether ITS side is still reachable, which ends
 * up finer-grained than a rectangle can be (a still-live pair's other,
 * now-impossible side can dim on its own, rather than waiting for the
 * whole row to resolve).
 */
export function SymbolGrid<TIcon extends string>({ arrangement, iconSrc, revealedFaces = [] }: SymbolGridProps<TIcon>) {
  return (
    <div className="grid h-full min-h-0 w-full grid-flow-col grid-cols-2 grid-rows-4 gap-x-2 gap-y-1 border-2 border-fg bg-card p-2">
      {SYMBOL_PAIRS.map((pair) => {
        const icons = arrangement[pair.index]
        const oPossible = cellIsPossible(pair.index, 'o', revealedFaces)
        const xPossible = cellIsPossible(pair.index, 'x', revealedFaces)
        return (
          <div key={pair.index} className="flex min-h-0 items-center justify-between gap-2 border border-fg/40 px-2">
            <img
              src={iconSrc[icons.o]}
              alt=""
              className={`h-6 w-6 shrink-0 object-contain transition-opacity duration-300 ${oPossible ? 'opacity-100' : 'opacity-20'}`}
            />
            <span
              className={`font-body text-xs uppercase tracking-widest text-fg transition-opacity duration-300 ${
                oPossible || xPossible ? 'opacity-100' : 'opacity-20'
              }`}
            >
              {pair.label}
            </span>
            <img
              src={iconSrc[icons.x]}
              alt=""
              className={`h-6 w-6 shrink-0 object-contain transition-opacity duration-300 ${xPossible ? 'opacity-100' : 'opacity-20'}`}
            />
          </div>
        )
      })}
    </div>
  )
}
