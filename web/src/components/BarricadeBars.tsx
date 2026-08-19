import strikethroughInk from '../assets/cross-out/strikethrough-ink.png'

/**
 * The three progress bars laid over BarricadeScene: humans' medkit action
 * bar (6 cells), demons' knife action bar (9 cells), and humans' barricade
 * defense bar (5 cells, sitting above the knife bar — its own marks push
 * back how many knife cells demons actually need, a later step). Cell
 * centers below are real pixel positions in Figma's own 409x311
 * BarricadeScene frame, transcribed from Josh's own reference marks in
 * BarricadeSceneExample (node 221:1080) — each bar's own array is ordered
 * nearest-to-center (index 0) outward to the uncontestable final cell
 * (last index), matching how the bars actually fill.
 *
 * The mark graphic itself (strikethrough-ink, reused from CrossOutMark) is
 * an explicit placeholder — Josh's own call: "I will definitely want a
 * different graphic for the eventual 'cross off graphic', but as a
 * reference point for center positions they work fine." No animation here
 * either (unlike CrossOutMark's full reveal+hand sequence) — this is
 * purely a static settled mark, since there's no per-flip reveal moment to
 * animate yet.
 */
interface BarCellGeometry {
  leftPx: number
  topPx: number
  sizePx: number
}

const SCENE_WIDTH = 409
const SCENE_HEIGHT = 311

const HUMAN_MEDKIT_CELLS: BarCellGeometry[] = [238, 259, 281, 303, 325, 362].map((leftPx) => ({
  leftPx,
  topPx: 264,
  sizePx: 43,
}))

const DEMON_KNIFE_CELLS: BarCellGeometry[] = [136, 117, 98, 82, 64, 46, 30, 10, -11].map((leftPx) => ({
  leftPx,
  topPx: 264,
  sizePx: 43,
}))

const BARRICADE_DEFENSE_CELLS: BarCellGeometry[] = [74, 57, 39, 21, -1].map((leftPx) => ({
  leftPx,
  topPx: 213,
  sizePx: 31,
}))

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

interface BarricadeBarsProps {
  /** How many cells of each bar are marked, counting from the cell
   * nearest center outward. All default to 0 (fully unmarked) -- no real
   * score data is wired up to this yet; that's the gameplay-loop step
   * that comes after this one. */
  humanMarked?: number
  demonMarked?: number
  barricadeMarked?: number
}

export function BarricadeBars({ humanMarked = 0, demonMarked = 0, barricadeMarked = 0 }: BarricadeBarsProps) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {HUMAN_MEDKIT_CELLS.slice(0, humanMarked).map((cell, i) => (
        <BarCellMark key={i} cell={cell} markColor="var(--color-humans)" />
      ))}
      {DEMON_KNIFE_CELLS.slice(0, demonMarked).map((cell, i) => (
        <BarCellMark key={i} cell={cell} markColor="var(--color-demons)" />
      ))}
      {BARRICADE_DEFENSE_CELLS.slice(0, barricadeMarked).map((cell, i) => (
        <BarCellMark key={i} cell={cell} markColor="var(--color-humans)" />
      ))}
    </div>
  )
}
