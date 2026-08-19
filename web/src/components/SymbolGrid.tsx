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
      className={`h-6 w-6 shrink-0 bg-fg transition-opacity duration-300 ${possible ? 'opacity-100' : 'opacity-20'}`}
      style={maskStyle(src)}
    />
  )
}

/**
 * The Teamwork Family's shared coin-grid mechanic (see lib/symbolGrid.ts
 * for the bit math) -- 8 pairs, each showing its own 3-flip label between
 * two result icons: left = O (tails), right = X (heads), matching the
 * coin's own left/bottom=O, right/top=X convention. `grid-flow-col` fills
 * column-by-column, matching SYMBOL_PAIRS' own real display order.
 *
 * Matches the real BarricadeBoardConfig spec (Figma node 221:1079)
 * directly: no padding, no gaps -- every cell shares a full border with
 * its neighbors (computed per-cell from its column-major grid position
 * rather than relying on CSS gap+border-collapse tricks) and the whole
 * grid sits on bg-bg, not a separate card surface. Within a pair, a thin
 * line would run straight across separating its O and X icons -- except
 * it's interrupted right where the label sits, achieved literally: the
 * line only spans the label's own column, and the label's bg-bg patch
 * covers the middle of it, leaving short flanking dashes visible (the
 * label reads as an "open box" cut into the line, per Josh's own
 * description). Each of the 3 elements (icon/label/icon) centers within
 * its own equal third via a 3-column sub-grid, rather than the old
 * push-to-the-edges justify-between.
 *
 * Icons are mask-and-tint (see Icon above) instead of plain <img>, so
 * they read the live color scheme's foreground color like everything
 * else -- generic over the icon set on purpose, since which icons appear
 * (and what they mean) is entirely a per-Sheet config, passed in rather
 * than imported here.
 */
export function SymbolGrid<TIcon extends string>({ arrangement, iconSrc, revealedFaces = [] }: SymbolGridProps<TIcon>) {
  return (
    <div className="grid h-full min-h-0 w-full grid-flow-col grid-cols-2 grid-rows-4 border-2 border-fg bg-bg">
      {SYMBOL_PAIRS.map((pair, i) => {
        const icons = arrangement[pair.index]
        const oPossible = cellIsPossible(pair.index, 'o', revealedFaces)
        const xPossible = cellIsPossible(pair.index, 'x', revealedFaces)
        const col = Math.floor(i / 4)
        const row = i % 4
        const borderClass = `${col === 0 ? 'border-r' : ''} ${row !== 3 ? 'border-b' : ''} border-fg`
        return (
          <div key={pair.index} className={`grid min-h-0 grid-cols-3 items-center ${borderClass}`}>
            <div className="flex items-center justify-center">
              <Icon src={iconSrc[icons.o]} possible={oPossible} />
            </div>
            <div
              className={`relative flex items-center justify-center transition-opacity duration-300 ${
                oPossible || xPossible ? 'opacity-100' : 'opacity-20'
              }`}
            >
              <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-fg" />
              <span className="relative z-10 bg-bg px-1 font-body text-xs uppercase tracking-widest text-fg">{pair.label}</span>
            </div>
            <div className="flex items-center justify-center">
              <Icon src={iconSrc[icons.x]} possible={xPossible} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
