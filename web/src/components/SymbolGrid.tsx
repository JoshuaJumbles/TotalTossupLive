import { SYMBOL_PAIRS } from '../lib/symbolGrid'

interface SymbolGridProps<TIcon extends string> {
  /** Which icon goes on each pair's O side (left cell) and X side (right
   * cell), keyed by the pair's index -- a per-Sheet concern, see e.g.
   * lib/barricadeSymbols.ts's BARRICADE_ARRANGEMENT. */
  arrangement: Record<number, { o: TIcon; x: TIcon }>
  /** Icon key -> image src, so this component never hardcodes any one
   * Sheet's icon set. */
  iconSrc: Record<TIcon, string>
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
 * 221:1079 / 221:1076) once Figma reconnected this session.
 */
export function SymbolGrid<TIcon extends string>({ arrangement, iconSrc }: SymbolGridProps<TIcon>) {
  return (
    <div className="grid h-full min-h-0 w-full grid-flow-col grid-cols-2 grid-rows-4 gap-x-2 gap-y-1 border-2 border-fg bg-card p-2">
      {SYMBOL_PAIRS.map((pair) => {
        const icons = arrangement[pair.index]
        return (
          <div key={pair.index} className="flex min-h-0 items-center justify-between gap-2 border border-fg/40 px-2">
            <img src={iconSrc[icons.o]} alt="" className="h-6 w-6 shrink-0 object-contain" />
            <span className="font-body text-xs uppercase tracking-widest text-fg">{pair.label}</span>
            <img src={iconSrc[icons.x]} alt="" className="h-6 w-6 shrink-0 object-contain" />
          </div>
        )
      })}
    </div>
  )
}
