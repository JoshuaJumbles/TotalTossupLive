import type { CloudFightIcon } from '@total-tossup-live/shared'
import strikethroughInk from '../assets/cross-out/strikethrough-ink.png'

/**
 * The four progress bars laid over CloudFightScene: demons' snake action
 * bar (6 cells, fixed target, no defense-boundary gap -- same shape as
 * Barricade's own knife bar), demons' skull defense bar (5 cells, pushes
 * back the human action target), and humans' own action bar -- split
 * across two visual lanes, jetpack and bow, sharing one score (Josh's own
 * "handoff" mechanic). Cell centers are real pixel positions in Figma's
 * own 409x311 CloudFightSheet frame (node 260:1282), transcribed from the
 * real DemonAttackMarks/DemonDefenseMarks/HumanJetpackMarks/
 * HumanArrowMarks coordinates.
 *
 * Direction is confirmed for all four bars now -- the snake bar and the
 * jetpack/bow bars against the scene's own printed numbers, and the skull
 * defense bar against Josh's own live-verification pass: ascending x, so
 * it visually lines up with the human action bars' own #5-8 slots (the
 * ones it's actually defending).
 *
 * The mark graphic is the same strikethrough-ink placeholder Barricade's
 * own bars use -- Josh's own call, a stand-in until a real "cross off"
 * graphic exists.
 */
interface BarCellGeometry {
  leftPx: number
  topPx: number
  sizePx: number
}

const SCENE_WIDTH = 409
const SCENE_HEIGHT = 311

// Position "1" (nearest/first) at the rightmost x, since the scene's own
// printed numbers ("6 5 4 3 2 1") read left-to-right descending.
const SNAKE_ACTION_CELLS: BarCellGeometry[] = [123, 102, 80, 59, 37, 2].map((leftPx) => ({
  leftPx,
  topPx: 261,
  sizePx: 40,
}))

// Position "1" at the leftmost x -- lines up with the human action bars'
// own #5-8 slots directly below (the ones this bar is actually defending),
// per Josh's own visual check.
const SKULL_DEFENSE_CELLS: BarCellGeometry[] = [300, 318, 337, 356, 378].map((leftPx) => ({
  leftPx,
  topPx: 187,
  sizePx: 30,
}))

// Position "1" at the leftmost x -- the scene's own printed numbers
// ("1 2 3 4 5 6 7 8") read left-to-right ascending, and the last cell's
// own extra gap (22px vs. the ~18px regular pitch) matches the same
// visually-separated "final" cell convention Barricade's own bars use.
const JETPACK_X = [234, 251, 269, 287, 306, 324, 342, 359, 381]
const HUMAN_JETPACK_CELLS: BarCellGeometry[] = JETPACK_X.map((leftPx) => ({ leftPx, topPx: 243, sizePx: 34 }))
const HUMAN_ARROW_CELLS: BarCellGeometry[] = JETPACK_X.map((leftPx) => ({ leftPx, topPx: 274, sizePx: 34 }))

function pct(px: number, of: number): string {
  return `${(px / of) * 100}%`
}

function BarCellMark({ cell, markColor }: { cell: BarCellGeometry; markColor: string }) {
  return (
    <div
      className="absolute"
      style={{
        left: pct(cell.leftPx, SCENE_WIDTH),
        top: pct(cell.topPx, SCENE_HEIGHT),
        width: pct(cell.sizePx, SCENE_WIDTH),
        height: pct(cell.sizePx, SCENE_HEIGHT),
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: markColor,
          WebkitMaskImage: `url(${strikethroughInk})`,
          maskImage: `url(${strikethroughInk})`,
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat',
          WebkitMaskSize: '100% 100%',
          maskSize: '100% 100%',
        }}
      />
    </div>
  )
}

interface CloudFightBarsProps {
  /** The attacker (human) action track's own marks, in order -- entry i
   * says which lane (jetpack or bow) claimed that track's (i+1)th slot.
   * This is nightState.attackerAction straight off the engine: the "which
   * lane" data the dual-lane handoff needs is already exactly this shape,
   * no extra bookkeeping required (see shared/family.ts's
   * TeamworkTrackMarks doc comment). */
  attackerMarks?: CloudFightIcon[]
  /** How many cells of the snake/skull bars are marked, counting from the
   * cell nearest position "1" outward. Both default to 0. */
  snakeMarked?: number
  skullMarked?: number
}

export function CloudFightBars({ attackerMarks = [], snakeMarked = 0, skullMarked = 0 }: CloudFightBarsProps) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {attackerMarks.map((icon, i) => (
        <BarCellMark
          key={i}
          cell={icon === 'jetpack' ? HUMAN_JETPACK_CELLS[i] : HUMAN_ARROW_CELLS[i]}
          markColor="var(--color-humans)"
        />
      ))}
      {SNAKE_ACTION_CELLS.slice(0, snakeMarked).map((cell, i) => (
        <BarCellMark key={i} cell={cell} markColor="var(--color-demons)" />
      ))}
      {SKULL_DEFENSE_CELLS.slice(0, skullMarked).map((cell, i) => (
        <BarCellMark key={i} cell={cell} markColor="var(--color-demons)" />
      ))}
    </div>
  )
}
