import { useMemo, useRef } from 'react'
import { useAnimationFrame } from 'framer-motion'
import type { Side, TrifectaNightState } from '@total-tossup-live/shared'
import { DrawingHand, HAND_GEOMETRY } from './DrawingHand'

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
  viewBoxWidth: number
  viewBoxHeight: number
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

/**
 * What lifting the pen between two strokes is "worth", in the same path
 * units as stroke length.
 *
 * Travel time can't come out of the strokes' own budget or a mark made of
 * many short strokes would draw at a visibly different speed from one
 * long one -- the exact problem length-proportional timing exists to
 * solve. Roughly a short stroke's worth reads as a real lift without
 * stalling the sequence.
 */
const LIFT_WEIGHT = 140

/** How far along the path to sample for the stroke's direction. Small
 * enough to be local, large enough that the jitter in a hand-drawn path
 * doesn't make the hand twitch. */
const TANGENT_SAMPLE = 0.02

type Beat =
  | { kind: 'draw'; target: number; stroke: number; from: number; to: number }
  | { kind: 'lift'; fromStroke: StrokeRef; toStroke: StrokeRef; from: number; to: number }

interface StrokeRef {
  target: number
  stroke: number
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

  /**
   * The round's whole pen timeline, as fractions of the pause: draw a
   * stroke, lift to the next, draw that one, and so on across every mark
   * that fell this round.
   */
  const beats = useMemo<Beat[]>(() => {
    if (drawingTargets.length === 0 || !drawingSide) return []

    const strokes: StrokeRef[] = drawingTargets.flatMap((target) =>
      art.marks[drawingSide][target].map((_, stroke) => ({ target, stroke })),
    )

    const weightOf = (ref: StrokeRef) => art.marks[drawingSide][ref.target][ref.stroke].length
    const total =
      strokes.reduce((sum, ref) => sum + weightOf(ref), 0) + LIFT_WEIGHT * (strokes.length - 1)

    const built: Beat[] = []
    let cursor = 0
    strokes.forEach((ref, i) => {
      if (i > 0) {
        const liftTo = cursor + LIFT_WEIGHT / total
        built.push({ kind: 'lift', fromStroke: strokes[i - 1], toStroke: ref, from: cursor, to: liftTo })
        cursor = liftTo
      }
      const drawTo = cursor + weightOf(ref) / total
      built.push({ kind: 'draw', target: ref.target, stroke: ref.stroke, from: cursor, to: drawTo })
      cursor = drawTo
    })
    return built
  }, [art, drawingSide, drawingTargets])

  const pathRefs = useRef(new Map<string, SVGPathElement>())
  const handRef = useRef<HTMLDivElement>(null)
  /** The hand's current tilt, carried between frames so it can ease
   * toward the stroke's direction instead of snapping to it. */
  const tiltRef = useRef(0)

  useAnimationFrame(() => {
    const hand = handRef.current
    if (beats.length === 0 || !phaseDurationMs || !drawingSide) {
      if (hand) hand.style.opacity = '0'
      return
    }

    const progress = Math.min(1, Math.max(0, (Date.now() - phaseStartedAt) / phaseDurationMs))
    const beat = beats.find((b) => progress <= b.to) ?? beats[beats.length - 1]
    const span = beat.to - beat.from
    const local = span > 0 ? Math.min(1, Math.max(0, (progress - beat.from) / span)) : 1

    // Each stroke is either already finished, mid-draw, or not started --
    // decided by where it sits relative to the beat currently running, so
    // seeking to any point in the window produces the right picture.
    const activeIndex = beats.indexOf(beat)
    for (const [key, path] of pathRefs.current) {
      const [target, stroke] = key.split(':').map(Number)
      const drawIndex = beats.findIndex(
        (b) => b.kind === 'draw' && b.target === target && b.stroke === stroke,
      )
      if (drawIndex < 0) continue
      const drawn = drawIndex < activeIndex ? 1 : drawIndex > activeIndex ? 0 : local
      path.style.strokeDashoffset = `${1 - drawn}`
    }

    if (!hand) return

    const pointOn = (ref: StrokeRef, at: number) => {
      const path = pathRefs.current.get(`${ref.target}:${ref.stroke}`)
      if (!path) return null
      const length = path.getTotalLength()
      const clamp = (v: number) => Math.min(length, Math.max(0, v))
      const here = path.getPointAtLength(clamp(at * length))
      const ahead = path.getPointAtLength(clamp((at + TANGENT_SAMPLE) * length))
      // Radians, because the tilt below maps it through sin() rather than
      // using it as an angle directly.
      return { x: here.x, y: here.y, angle: Math.atan2(ahead.y - here.y, ahead.x - here.x) }
    }

    const position =
      beat.kind === 'draw'
        ? pointOn({ target: beat.target, stroke: beat.stroke }, local)
        : (() => {
            // Travelling between strokes: a straight hop from where the pen
            // left off to where it comes back down.
            const from = pointOn(beat.fromStroke, 1)
            const to = pointOn(beat.toStroke, 0)
            if (!from || !to) return from ?? to
            return {
              x: from.x + (to.x - from.x) * local,
              y: from.y + (to.y - from.y) * local,
              angle: to.angle,
            }
          })()

    if (!position) {
      hand.style.opacity = '0'
      return
    }

    // Fade in as the pen comes down and out once the last stroke lands, so
    // the hand doesn't pop on and off at the window's edges.
    const fade = progress < 0.05 ? progress / 0.05 : progress > 0.94 ? (1 - progress) / 0.06 : 1
    hand.style.opacity = `${Math.min(1, Math.max(0, fade))}`
    hand.style.left = `${(position.x / art.viewBoxWidth) * 100}%`
    hand.style.top = `${(position.y / art.viewBoxHeight) * 100}%`

    // A slight wrist rather than a hand that spins to face the stroke.
    // sin() of the tangent gives the bound Joshua asked for (never past
    // maxTiltDeg) while staying continuous through the direction
    // reversals these marks are full of -- clamping the raw angle instead
    // would snap by 2x the limit every time a stroke crossed vertical.
    // Horizontal strokes sit upright either way, which is also what a
    // real hand does drawing left versus right.
    const tiltTarget = HAND_GEOMETRY.maxTiltDeg * Math.sin(position.angle)
    tiltRef.current =
      progress < 0.02
        ? tiltTarget
        : tiltRef.current + (tiltTarget - tiltRef.current) * HAND_GEOMETRY.tiltSmoothing
    hand.style.transform =
      `translate(-${HAND_GEOMETRY.tipXPct}%, -${HAND_GEOMETRY.tipYPct}%) ` +
      `rotate(${tiltRef.current.toFixed(2)}deg)`
  })

  return (
    <div className="pointer-events-none absolute inset-0">
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox={`0 0 ${art.viewBoxWidth} ${art.viewBoxHeight}`}
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

      {drawingSide && beats.length > 0 && (
        <DrawingHand ref={handRef} isRed={MARK_COLOR[drawingSide] === 'var(--color-demons)'} />
      )}
    </div>
  )
}
