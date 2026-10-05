import type { RefObject } from 'react'
import { useRef } from 'react'
import { useAnimationFrame } from 'framer-motion'
import { HAND_GEOMETRY } from '../components/DrawingHand'

/** One stroke in the order it gets drawn. `weight` decides how much of
 * the window it takes; leaving it out measures the path instead, which is
 * what a generated path (an arrow) wants, while authored art passes the
 * length baked at build time. */
export interface HandStroke {
  key: string
  weight?: number
}

/**
 * What lifting the pen between two strokes is "worth", in the same units
 * as stroke length. Travel time can't come out of the strokes' own budget
 * or a mark made of many short strokes draws at a visibly different speed
 * from one long one -- the exact problem length-proportional timing
 * exists to solve.
 */
const DEFAULT_LIFT_WEIGHT = 140

/** How far along a path to sample for its direction. Small enough to be
 * local, large enough that the jitter in a hand-drawn path doesn't make
 * the hand twitch. */
const TANGENT_SAMPLE = 0.02

type Beat =
  | { kind: 'draw'; key: string; from: number; to: number }
  | { kind: 'lift'; fromKey: string; toKey: string; from: number; to: number }

interface HandDrawingOptions {
  /** The strokes to draw, in order. Empty means nothing is being drawn
   * and the hand stays hidden. */
  strokes: HandStroke[]
  pathFor: (key: string) => SVGPathElement | null | undefined
  handRef: RefObject<HTMLDivElement | null>
  /** When the window began, on the same server clock the rest of the app
   * renders from -- so a viewer reconnecting mid-pause picks the drawing
   * up where it actually is rather than restarting it. */
  startedAt: number
  /** The window to spread the strokes across. Undefined means "not a
   * drawing moment", which hides the hand. */
  durationMs?: number
  liftWeight?: number
  /**
   * The box the hand is positioned inside. The pen's position is resolved
   * through each path's own screen matrix rather than a caller-supplied
   * mapping, so strokes living in different coordinate spaces can share
   * one sequence -- which is what lets Rock Paper Flipper draw an arrow
   * across the ring and then a wound inside a single character's box,
   * with one hand, in one pass.
   */
  containerRef: RefObject<HTMLElement | null>
}

/**
 * Drives a hand along a sequence of SVG paths, revealing each one as it
 * goes: the shared machinery behind both the Trifecta Sheets' authored
 * marks and Rock Paper Flipper's generated arrows.
 *
 * Strokes take time in proportion to their length rather than an equal
 * share, which gives one pen speed across everything in the window -- a
 * round's marks can differ by more than 20x in size, and an equal split
 * draws the big one at a crawl and the small one in a blink. Between
 * strokes the pen lifts and travels, which is why that gap is paid for
 * out of its own budget rather than the strokes'.
 *
 * The caller owns the paths and the hand element; this writes
 * `strokeDashoffset` on the former and position, tilt and opacity on the
 * latter, every frame, without re-rendering React.
 */
export function useHandDrawing({
  strokes,
  pathFor,
  handRef,
  startedAt,
  durationMs,
  liftWeight = DEFAULT_LIFT_WEIGHT,
  containerRef,
}: HandDrawingOptions): void {
  /** Carried between frames so the tilt can ease toward the stroke's
   * direction instead of snapping to it. */
  const tiltRef = useRef(0)

  useAnimationFrame(() => {
    const hand = handRef.current
    const active = strokes.length > 0 && !!durationMs

    if (!active) {
      if (hand) hand.style.opacity = '0'
      return
    }

    // The timeline is rebuilt each frame rather than memoised: a
    // generated path's length isn't known until it's in the DOM, and at
    // these stroke counts the arithmetic is far cheaper than the
    // bookkeeping needed to cache it correctly.
    const weightOf = (stroke: HandStroke): number => {
      if (stroke.weight !== undefined) return stroke.weight
      const path = pathFor(stroke.key)
      return path ? path.getTotalLength() : 1
    }

    const weights = strokes.map(weightOf)
    const total = weights.reduce((a, b) => a + b, 0) + liftWeight * (strokes.length - 1)
    if (total <= 0) return

    const beats: Beat[] = []
    let cursor = 0
    strokes.forEach((stroke, i) => {
      if (i > 0) {
        const liftTo = cursor + liftWeight / total
        beats.push({ kind: 'lift', fromKey: strokes[i - 1].key, toKey: stroke.key, from: cursor, to: liftTo })
        cursor = liftTo
      }
      const drawTo = cursor + weights[i] / total
      beats.push({ kind: 'draw', key: stroke.key, from: cursor, to: drawTo })
      cursor = drawTo
    })

    const progress = Math.min(1, Math.max(0, (Date.now() - startedAt) / durationMs!))
    const beat = beats.find((b) => progress <= b.to) ?? beats[beats.length - 1]
    const span = beat.to - beat.from
    const local = span > 0 ? Math.min(1, Math.max(0, (progress - beat.from) / span)) : 1
    const activeIndex = beats.indexOf(beat)

    // Each stroke is either already finished, mid-draw, or not started --
    // decided by where it sits relative to the beat currently running, so
    // seeking to any point in the window produces the right picture.
    strokes.forEach((stroke) => {
      const path = pathFor(stroke.key)
      if (!path) return
      const drawIndex = beats.findIndex((b) => b.kind === 'draw' && b.key === stroke.key)
      if (drawIndex < 0) return
      const drawn = drawIndex < activeIndex ? 1 : drawIndex > activeIndex ? 0 : local
      path.style.strokeDashoffset = `${1 - drawn}`
    })

    if (!hand) return

    const pointOn = (key: string, at: number) => {
      const path = pathFor(key)
      if (!path) return null
      const ctm = path.getScreenCTM()
      if (!ctm) return null
      const length = path.getTotalLength()
      const clamp = (v: number) => Math.min(length, Math.max(0, v))
      // Through the path's own matrix, so a stroke nested inside a
      // transformed or differently-scaled SVG lands correctly without the
      // caller knowing anything about where it lives.
      const toViewport = (p: DOMPoint) => ({
        x: p.x * ctm.a + p.y * ctm.c + ctm.e,
        y: p.x * ctm.b + p.y * ctm.d + ctm.f,
      })
      const here = toViewport(path.getPointAtLength(clamp(at * length)))
      const ahead = toViewport(path.getPointAtLength(clamp((at + TANGENT_SAMPLE) * length)))
      // Radians, because the tilt below maps it through sin() rather than
      // using it as an angle directly.
      return { x: here.x, y: here.y, angle: Math.atan2(ahead.y - here.y, ahead.x - here.x) }
    }

    const position =
      beat.kind === 'draw'
        ? pointOn(beat.key, local)
        : (() => {
            // Travelling between strokes: a straight hop from where the
            // pen left off to where it comes back down.
            const from = pointOn(beat.fromKey, 1)
            const to = pointOn(beat.toKey, 0)
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

    // Fade in as the pen comes down and out once the last stroke lands,
    // so the hand doesn't pop on and off at the window's edges.
    const fade = progress < 0.05 ? progress / 0.05 : progress > 0.94 ? (1 - progress) / 0.06 : 1
    hand.style.opacity = `${Math.min(1, Math.max(0, fade))}`

    const box = containerRef.current?.getBoundingClientRect()
    if (!box || box.width === 0) return
    hand.style.left = `${((position.x - box.left) / box.width) * 100}%`
    hand.style.top = `${((position.y - box.top) / box.height) * 100}%`

    // A slight wrist rather than a hand that spins to face the stroke.
    // sin() of the tangent gives a bound it never exceeds while staying
    // continuous through direction reversals -- clamping the raw angle
    // instead would snap by twice the limit every time a stroke crossed
    // vertical, which on a scribbled mark is most of the time.
    const tiltTarget = HAND_GEOMETRY.maxTiltDeg * Math.sin(position.angle)
    tiltRef.current =
      progress < 0.02
        ? tiltTarget
        : tiltRef.current + (tiltTarget - tiltRef.current) * HAND_GEOMETRY.tiltSmoothing
    hand.style.transform =
      `translate(-${HAND_GEOMETRY.tipXPct}%, -${HAND_GEOMETRY.tipYPct}%) ` +
      `rotate(${tiltRef.current.toFixed(2)}deg)`
  })
}
