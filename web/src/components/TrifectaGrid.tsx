import type { CoinFace, TrifectaCell } from '@total-tossup-live/shared'
import { cellIsPossible } from '@total-tossup-live/shared'
import { maskStyle } from '../lib/maskStyle'
import { SYMBOL_PAIRS } from '../lib/symbolGrid'

interface TrifectaGridProps<TIcon extends string> {
  /** Which cell sits on each pair's O side (left) and X side (right),
   * keyed by pair index -- broadcast as part of ChannelSnapshot.sheetConfig
   * (see worker/src/families/kingHumanData.ts). */
  arrangement: Record<number, { o: TrifectaCell<TIcon>; x: TrifectaCell<TIcon> }>
  /** Icon key -> mask source (alpha-only line art, same mask-and-tint
   * technique as every other icon in the app). */
  iconSrc: Record<TIcon, string>
  /** The Trifecta side's three elements, in the order the tile draws them. */
  elements: readonly TIcon[]
  /** Which of those elements have shown up so far -- the tile's lit ones,
   * and therefore what a hit on it is currently worth. */
  activated: readonly TIcon[]
  /** The current round's flips so far; drives the narrowing-focus dim,
   * same as the Teamwork grid's. */
  revealedFaces?: readonly (CoinFace | null)[]
}

/** Same color-shift treatment SymbolGrid's own icons use: "not in play"
 * reads as bg-fg/25 rather than a whole-element opacity drop, so nothing
 * behind it bleeds through. */
function Icon({ src, lit, sizeClass }: { src: string; lit: boolean; sizeClass: string }) {
  return (
    <div
      className={`${sizeClass} shrink-0 transition-colors duration-300 ${lit ? 'bg-fg' : 'bg-fg/25'}`}
      style={maskStyle(src)}
    />
  )
}

/**
 * The Trifecta Family's coin-result grid. Same 4x4 skeleton and same
 * narrowing-focus dim as the Teamwork Family's SymbolGrid (and the same
 * shared bit math behind it -- SYMBOL_PAIRS for display order,
 * cellIsPossible for the dim), with the two things Trifecta adds:
 *
 * 1. A cell can hold one OR two symbols -- that count *is* its damage,
 *    so a two-symbol cell draws both, a little smaller.
 * 2. The Trifecta tile spans two cells. Rather than teaching the grid
 *    about spanning cells, the two cells it covers render empty and the
 *    tile is drawn as an absolutely-positioned overlay on top of them --
 *    which is also how the Figma composites it (a board with activation
 *    marks laid over). Its position is derived from wherever the
 *    arrangement actually puts it rather than configured per Sheet: the
 *    two cells are always side by side across the board's centre line,
 *    so min/max of their columns is the whole calculation.
 *
 * Deliberately NOT folded into SymbolGrid yet, even though the 4x4
 * skeleton and label overlay are near-identical. Joshua and I agreed the
 * grid-flexibility pass gets its own conversation once there are more
 * custom-cell Families to design against (he's flagged others coming) --
 * generalizing off this single case first is the same mistake we avoided
 * by building Rooftop before generalizing the Teamwork engine. The
 * duplication here is temporary and known.
 */
export function TrifectaGrid<TIcon extends string>({
  arrangement,
  iconSrc,
  elements,
  activated,
  revealedFaces = [],
}: TrifectaGridProps<TIcon>) {
  const roundFullyResolved = revealedFaces.length >= 4

  // Collected while laying out the cells so the tile overlay knows where
  // to sit -- see this component's own doc comment.
  const tileCells: { row: number; col: number; possible: boolean }[] = []

  const iconCells = Array.from({ length: 4 }).flatMap((_, row) =>
    Array.from({ length: 4 }).map((_, col) => {
      const pairCol = Math.floor(col / 2)
      const side: 'o' | 'x' = col % 2 === 0 ? 'o' : 'x'
      const pair = SYMBOL_PAIRS[pairCol * 4 + row]
      const cell = arrangement[pair.index][side]
      const possible = cellIsPossible(pair.index, side, revealedFaces)
      const borderClass = `${col !== 3 ? 'border-r' : ''} ${row !== 3 ? 'border-b' : ''} border-fg`

      if (cell.kind === 'trifecta') tileCells.push({ row, col, possible })

      return (
        <div key={`${row}-${col}`} className={`flex items-center justify-center gap-0.5 ${borderClass}`}>
          {cell.kind === 'symbols' &&
            cell.symbols.map((icon, i) => (
              <Icon
                key={i}
                src={iconSrc[icon]}
                lit={possible}
                sizeClass={cell.symbols.length > 1 ? 'h-5 w-5' : 'h-7 w-7'}
              />
            ))}
        </div>
      )
    }),
  )

  return (
    <div className="relative grid h-full min-h-0 w-full grid-cols-4 grid-rows-4 border-2 border-fg bg-bg">
      {iconCells}

      {tileCells.length > 0 && <TrifectaTile cells={tileCells} elements={elements} activated={activated} iconSrc={iconSrc} />}

      <div className="pointer-events-none absolute inset-0">
        {SYMBOL_PAIRS.map((pair, i) => {
          const pairCol = Math.floor(i / 4)
          const pairRow = i % 4
          const oPossible = cellIsPossible(pair.index, 'o', revealedFaces)
          const xPossible = cellIsPossible(pair.index, 'x', revealedFaces)
          const labelActive = !roundFullyResolved && (oPossible || xPossible)
          return (
            <span
              key={pair.index}
              className="absolute -translate-x-1/2 -translate-y-1/2 bg-bg px-1 font-body text-xs uppercase tracking-widest"
              style={{ left: `${(pairCol * 2 + 1) * 25}%`, top: `${(pairRow + 0.5) * 25}%` }}
            >
              <span className={`transition-colors duration-300 ${labelActive ? 'text-fg' : 'text-fg/30'}`}>{pair.label}</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}

/** The tile itself: one box covering the cells the arrangement gave it,
 * holding the Trifecta side's three elements. A lit element is one that
 * has shown up in the action, and the number lit is exactly what a hit on
 * this tile is worth -- so the tile visibly "charges" over a Night. */
function TrifectaTile<TIcon extends string>({
  cells,
  elements,
  activated,
  iconSrc,
}: {
  cells: { row: number; col: number; possible: boolean }[]
  elements: readonly TIcon[]
  activated: readonly TIcon[]
  iconSrc: Record<TIcon, string>
}) {
  const cols = cells.map((cell) => cell.col)
  const left = Math.min(...cols) * 25
  const width = (Math.max(...cols) - Math.min(...cols) + 1) * 25
  const top = cells[0].row * 25
  // The tile spans two cells from two *different* pairs, so it stays in
  // play as long as either of them does.
  const possible = cells.some((cell) => cell.possible)

  return (
    <div
      className="pointer-events-none absolute flex items-center justify-center p-1"
      style={{ left: `${left}%`, width: `${width}%`, top: `${top}%`, height: '25%' }}
    >
      <div
        className={`flex h-full w-full items-center justify-center gap-1 rounded-md border-2 bg-bg transition-colors duration-300 ${
          possible ? 'border-fg' : 'border-fg/25'
        }`}
      >
        {elements.map((element) => {
          const isLit = activated.includes(element)
          return (
            <div
              key={element}
              className={`flex items-center justify-center rounded-full border p-0.5 transition-colors duration-300 ${
                isLit ? 'border-fg' : 'border-transparent'
              }`}
            >
              <Icon src={iconSrc[element]} lit={possible && isLit} sizeClass="h-4 w-4" />
            </div>
          )
        })}
      </div>
    </div>
  )
}
