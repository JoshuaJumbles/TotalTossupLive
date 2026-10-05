import { useMemo } from 'react'
import type { RpfBout, RpfNightState, RpfSheetConfig, Side } from '@total-tossup-live/shared'
import { CHARACTER_FRAC, CHARACTER_RADIUS_FRAC, RING_SCALE, angleFor, point } from '../lib/rpfRing'

/** How far back from a fighter's centre an arrow stops, so the head lands
 * at the edge of the art rather than buried under it. */
const CLEARANCE = CHARACTER_FRAC * 0.45 * RING_SCALE * 100

/** How far the shaft bows off the straight chord, as a fraction of its
 * own length. Straight lines between eight points on a circle pile up
 * into an unreadable star; a bow separates them and reads as drawn
 * rather than ruled. */
const BOW = 0.18

/** Successive arrows between the same two fighters get a slightly
 * different bow so they fan out instead of landing on top of each other
 * -- which happens often late in a Night, when one side keeps hitting the
 * same weak spot. */
const BOW_SPREAD = 0.07

const HEAD_LENGTH = 3.2
const HEAD_SPREAD_DEG = 26

interface Drawn {
  key: string
  shaft: string
  head: [string, string]
  attacker: Side
  /** 0 for the bout that just landed, rising into the past. */
  age: number
}

/**
 * Builds one bout's arrow: a bowed shaft from whoever struck to whoever
 * took it, plus the two strokes of a head.
 *
 * Note the target is the bout's `defenderIndex` rather than the fighter
 * the flips named. On a weak-spot round those differ -- the blow goes
 * through a downed fighter to the Royalty behind them -- and the arrow
 * showing the real path is the whole point of drawing it.
 */
function drawBout(bout: RpfBout, config: RpfSheetConfig, index: number, age: number): Drawn {
  const attacker = bout.attacker
  const attackerOnLeft = config.leftSide === attacker

  const from = point(angleFor(bout.picked[attacker], attackerOnLeft), CHARACTER_RADIUS_FRAC)
  const to = point(angleFor(bout.defenderIndex, !attackerOnLeft), CHARACTER_RADIUS_FRAC)

  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy) || 1
  const ux = dx / length
  const uy = dy / length

  const start = { x: from.x + ux * CLEARANCE, y: from.y + uy * CLEARANCE }
  const end = { x: to.x - ux * CLEARANCE, y: to.y - uy * CLEARANCE }

  // Bow consistently to one side of the chord, nudged per round so
  // repeats between the same pair separate.
  const bow = (BOW + (index % 3) * BOW_SPREAD) * Math.hypot(end.x - start.x, end.y - start.y)
  const control = {
    x: (start.x + end.x) / 2 - uy * bow,
    y: (start.y + end.y) / 2 + ux * bow,
  }

  // The head follows the curve's own final direction, not the chord's,
  // or it sits crooked on a strongly bowed shaft.
  const tangent = Math.atan2(end.y - control.y, end.x - control.x)
  const barb = (sign: number) => {
    const a = tangent + Math.PI + (sign * HEAD_SPREAD_DEG * Math.PI) / 180
    return `M${end.x.toFixed(2)},${end.y.toFixed(2)} L${(end.x + Math.cos(a) * HEAD_LENGTH).toFixed(2)},${(end.y + Math.sin(a) * HEAD_LENGTH).toFixed(2)}`
  }

  return {
    key: `${age}-${index}`,
    shaft: `M${start.x.toFixed(2)},${start.y.toFixed(2)} Q${control.x.toFixed(2)},${control.y.toFixed(2)} ${end.x.toFixed(2)},${end.y.toFixed(2)}`,
    head: [barb(1), barb(-1)],
    attacker,
    age,
  }
}

interface RpfArrowsProps {
  nightState: RpfNightState
  config: RpfSheetConfig
  /** True during the pause the newest arrow draws itself in. The arena
   * owns the hand, because the arrow and the wound it causes are one
   * drawing sequence. */
  drawing: boolean
  /** Hands each of the newest arrow's three strokes to the arena, which
   * sequences them with the wound. */
  registerPath: (key: string, el: SVGPathElement | null) => void
}

/** The newest arrow's strokes, in the order a hand would draw them. */
export const ARROW_STROKE_KEYS = ['arrow:shaft', 'arrow:head0', 'arrow:head1'] as const

/**
 * Every blow of the Night, drawn as an arrow from the fighter who struck
 * to the one who took it.
 *
 * On the physical sheet these accumulate by hand into a map of how the
 * fight went, which is why they're kept rather than cleared each round:
 * the engine records a bout per round and this renders all of them. The
 * newest draws itself in; older ones fade back so the latest action stays
 * readable against a Night's worth of history.
 *
 * Unlike every other mark in the app these paths are computed rather than
 * authored -- there are sixteen possible attacker/defender pairs per
 * side, so exporting art for each was never on the table.
 */
export function RpfArrows({ nightState, config, drawing, registerPath }: RpfArrowsProps) {
  const arrows = useMemo<Drawn[]>(() => {
    const bouts = nightState.history
    return bouts.map((bout, i) => drawBout(bout, config, i, bouts.length - 1 - i))
  }, [nightState.history, config])

  if (arrows.length === 0) return null

  return (
    <>
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      {arrows.map((arrow) => {
        const isFresh = arrow.age === 0
        const animating = isFresh && drawing
        // Older arrows fade toward a floor rather than to nothing, so the
        // whole Night stays legible without drowning the latest blow.
        const opacity = isFresh ? 0.95 : Math.max(0.16, 0.5 - arrow.age * 0.05)
        const stroke = `var(--color-${arrow.attacker})`
        return (
          <g key={arrow.key} stroke={stroke} fill="none" strokeLinecap="round" opacity={opacity}>
            {[
              { key: ARROW_STROKE_KEYS[0], d: arrow.shaft },
              { key: ARROW_STROKE_KEYS[1], d: arrow.head[0] },
              { key: ARROW_STROKE_KEYS[2], d: arrow.head[1] },
            ].map(
              (part) => (
                <path
                  // Animating and settled forms are deliberately different
                  // keys: the frame loop writes strokeDashoffset as an
                  // inline style, which React can't clear, so a path that
                  // merely switched props would carry its final offset into
                  // the next round. Remounting hands back a clean element.
                  key={animating ? `${part.key}-drawing` : part.key}
                  ref={animating ? (el) => registerPath(part.key, el) : undefined}
                  d={part.d}
                  strokeWidth={isFresh ? 1.1 : 0.7}
                  // Normalising to 1 lets the dash math ignore real arc
                  // length, so the reveal can't disagree with what the
                  // hook measured.
                  pathLength={animating ? 1 : undefined}
                  strokeDasharray={animating ? 1 : undefined}
                  strokeDashoffset={animating ? 1 : undefined}
                />
              ),
            )}
          </g>
        )
      })}
      </svg>
    </>
  )
}
