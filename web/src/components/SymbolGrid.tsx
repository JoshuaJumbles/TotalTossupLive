import { SYMBOL_PAIRS } from '../lib/symbolGrid'

/**
 * The Teamwork Family's shared coin-grid mechanic (see lib/symbolGrid.ts
 * for the bit math) -- 8 pairs, each showing its own 3-flip label between
 * two result cells: left = O (tails), right = X (heads), matching the
 * coin's own left/bottom=O, right/top=X convention. `grid-flow-col` fills
 * column-by-column (indices 0-3 down the left column, 4-7 down the
 * right) rather than the CSS grid default row-by-row.
 *
 * First-pass stub, deliberately EMPTY -- no per-Night symbol config yet.
 * That's the very next step: a config mapping each pair's O/X side to
 * which icon (and which team it favors) it resolves to for a given
 * Sheet, replacing the placeholder boxes below with real icons. Layout
 * here is a best-effort match to the pattern established by the original
 * barricade-board.png export (8 rows of label + 2 result slots, 2
 * physical columns of 4) -- exact spacing/typography is a pending
 * follow-up once Figma's newer BarricadeBoard/symbols frames (node
 * 221-1079 / 221-1076) are pullable again.
 */
export function SymbolGrid() {
  return (
    <div className="grid h-full min-h-0 w-full grid-flow-col grid-cols-2 grid-rows-4 gap-x-2 gap-y-1 border-2 border-fg bg-card p-2">
      {SYMBOL_PAIRS.map((pair) => (
        <div key={pair.index} className="flex min-h-0 items-center justify-between gap-2 border border-fg/40 px-2">
          <div className="h-6 w-6 shrink-0 rounded border border-fg/40" aria-hidden />
          <span className="font-body text-xs uppercase tracking-widest text-fg">{pair.label}</span>
          <div className="h-6 w-6 shrink-0 rounded border border-fg/40" aria-hidden />
        </div>
      ))}
    </div>
  )
}
