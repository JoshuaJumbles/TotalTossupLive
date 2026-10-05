import { useMemo, useRef } from 'react'
import type { Side, TrifectaNightState } from '@total-tossup-live/shared'
import { DrawingHand } from './DrawingHand'
import { useHandDrawing, type HandStroke } from '../lib/useHandDrawing'

/** One pen stroke: its SVG path, plus the arc length baked at build time
 * by web/scripts/extract-mark-paths.mjs. The length is only ever used to
 * weight how much of the window this stroke gets -- the reveal itself
 * normalizes through SVG's own `pathLength`, so a small disagreement
 * between our flattening and the browser's can't leave a sliver of ink
 * undrawn. */
export interface DrawnStroke {
  d: string
  length: number
}

/**
 * A Sheet's complete mark art. Both sides' nine marks live in one
 * coordinate space -- the same space the scene behind them is drawn in --
 * because Joshua authors them laid out in place over the scene art. That
 * is why there's no per-mark position table: a mark's position IS its
 * path data.
 */
export interface DrawnMarkSet {
  /** The rect the marks were drawn over, in the export's own coordinates
   * -- which is not always its viewBox. An export can carry padding the
   * scene doesn't occupy (Ambush's is 6.87 units wider than its scene),
   * and mapping the viewBox onto the scene box instead would shift every
   * mark by that much. The extractor works this out per Sheet. */
  viewBox: { minX: number; minY: number; width: number; height: number }
  strokeWidth: number
  /** [targetIndex][strokeIndex], index-aligned with that side's own
   * config.targets, so a destroyed target index looks its art up
   * directly. */
  marks: Record<Side, DrawnStroke[][]>
}

/** Whoever crossed this target off is the *other* side -- a human target
 * is marked in demons' color and vice versa, matching the physical game's
 * own pen convention. Note Creation will eventually invert this (a team
 * fills in its OWN shape), so this is a per-Family rule rather than a
 * constant, whenever that Family arrives. */
const MARK_COLOR: Record<Side, string> = {
  humans: 'var(--color-demons)',
  demons: 'var(--color-humans)',
}

interface TrifectaMarksProps {
  nightState: TrifectaNightState
  art: DrawnMarkSet
  /** When this pause began, in the same server clock the whole app renders
   * from. Driving the animation off the real elapsed time rather than a
   * transition that starts on mount means a viewer who reconnects
   * mid-pause picks the drawing up where it actually is, instead of
   * restarting it. */
  phaseStartedAt: number
  /** The pause this round landed in, if it's one where the marks that just
   * fell should be drawn rather than simply shown settled. Undefined
   * anywhere else, including every later render of the same round. */
  phaseDurationMs?: number
}

/**
 * Every destroyed target, inked onto the scene. A Trifecta Night ends when
 * one side's nine are all marked, so this is the actual scoreboard as much
 * as it is decoration.
 *
 * The marks that landed *this* round are drawn stroke by stroke, with a
 * hand following the pen: each stroke reveals along its own path via
 * `stroke-dashoffset`, and the hand sits wherever `getPointAtLength` says
 * the pen is. Which marks those are comes straight off nightState.lastRound
 * (server-computed and broadcast), so it survives a reconnect rather than
 * depending on having seen the previous snapshot.
 *
 * Time is split by path length rather than evenly: a round's marks can
 * differ by more than 20x in size, so an equal split would draw the torso
 * at a crawl and an upper arm in a blink. Weighting by length instead
 * gives one constant pen speed across everything in the round. The
 * coordinator has already widened the window in proportion to the number
 * of hits (see FlipOutcome.pauseScale), and this divides up whatever
 * window it's given -- which is also what lets a killing blow animate
 * correctly inside the longer night_won pause with no special-casing.
 */
export function TrifectaMarks({
  nightState,
  art,
  phaseStartedAt,
  phaseDurationMs,
}: TrifectaMarksProps) {
  const lastRound = nightState.lastRound
  const drawingSide = lastRound?.side
  const drawingTargets = useMemo(() => {
    if (!phaseDurationMs || !lastRound || lastRound.targets.length === 0) return []
    // Only targets this Sheet actually has art for -- same guard the old
    // geometry-table version needed, for a Sheet whose art hasn't caught
    // up with its target count.
    return lastRound.targets.filter((index) => art.marks[lastRound.side][index]?.length > 0)
  }, [art, lastRound, phaseDurationMs])

  /** The round's strokes in draw order, flattened across however many
   * marks landed. Weights are the lengths baked at build time, so the
   * pen keeps one speed across marks that differ by more than 20x in
   * size. */
  const strokes = useMemo<HandStroke[]>(() => {
    if (drawingTargets.length === 0 || !drawingSide) return []
    return drawingTargets.flatMap((target) =>
      art.marks[drawingSide][target].map((stroke, index) => ({
        key: `${target}:${index}`,
        weight: stroke.length,
      })),
    )
  }, [art, drawingSide, drawingTargets])

  const containerRef = useRef<HTMLDivElement>(null)
  const pathRefs = useRef(new Map<string, SVGPathElement>())
  const handRef = useRef<HTMLDivElement>(null)

  useHandDrawing({
    strokes,
    pathFor: (key) => pathRefs.current.get(key),
    handRef,
    startedAt: phaseStartedAt,
    durationMs: phaseDurationMs,
    containerRef,
  })

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0">
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox={`${art.viewBox.minX} ${art.viewBox.minY} ${art.viewBox.width} ${art.viewBox.height}`}
        // The scene art is stretched to this same box, so the marks match
        // it exactly rather than being letterboxed against it.
        preserveAspectRatio="none"
        aria-hidden
      >
        {(['humans', 'demons'] as Side[]).flatMap((side) =>
          nightState.destroyed[side].flatMap((targetIndex) => {
            const strokes = art.marks[side][targetIndex]
            if (!strokes) return []
            const isDrawing = side === drawingSide && drawingTargets.includes(targetIndex)

            return strokes.map((stroke, strokeIndex) => (
              <path
                // The drawing and settled forms of the same stroke are
                // deliberately different keys. The frame loop writes
                // strokeDashoffset as an inline style, and React can't
                // clear an inline style it didn't set -- so a stroke that
                // merely switched props would carry its final offset into
                // the next round. Remounting hands back a clean element.
                key={`${side}-${targetIndex}-${strokeIndex}${isDrawing ? '-drawing' : ''}`}
                ref={
                  isDrawing
                    ? (el) => {
                        const key = `${targetIndex}:${strokeIndex}`
                        if (el) pathRefs.current.set(key, el)
                        else pathRefs.current.delete(key)
                      }
                    : undefined
                }
                d={stroke.d}
                fill="none"
                stroke={MARK_COLOR[side]}
                strokeWidth={art.strokeWidth}
                // Miter joins at the sharp reversals are what give these
                // strokes their spiked, tapered ends -- Joshua's own line
                // style, and the reason these don't read as uniform pipes.
                // Round joins would flatten exactly that.
                strokeMiterlimit={10}
                // Normalizing to 1 lets the dash math ignore real arc
                // length entirely, so the reveal can't disagree with the
                // lengths baked at build time.
                pathLength={isDrawing ? 1 : undefined}
                strokeDasharray={isDrawing ? 1 : undefined}
                strokeDashoffset={isDrawing ? 1 : undefined}
              />
            ))
          }),
        )}
      </svg>

      {drawingSide && strokes.length > 0 && (
        <DrawingHand ref={handRef} isRed={MARK_COLOR[drawingSide] === 'var(--color-demons)'} />
      )}
    </div>
  )
}
