import { motion } from 'framer-motion'
import type { CoinFace } from '@total-tossup-live/shared'
import handPrepFill from '../assets/coin-hand/hand-prep-fill.png'
import handPrepLines from '../assets/coin-hand/hand-prep-lines.png'
import handFlickFill from '../assets/coin-hand/hand-flick-fill.png'
import handFlickLines from '../assets/coin-hand/hand-flick-lines.png'
import handOpenFill from '../assets/coin-hand/hand-open-fill.png'
import handOpenLines from '../assets/coin-hand/hand-open-lines.png'
import coinOval from '../assets/coin-hand/coin-oval.svg'

/**
 * Every position/size below is a percentage of the coin display's own
 * rendered box — one of 5 equal columns filling CoinFrame's full height,
 * per Josh's CoinDisplaySet reference in Figma (each column measured
 * 80×144 there). Expressing everything as % of the column's own size
 * (rather than measuring real pixels like useUnitIconSize does) works
 * here because it's pure CSS — Framer Motion animates percentage strings
 * natively — so this holds the same proportions at any real column size
 * with no JS measurement needed.
 *
 * The coin is one asset throughout (coin-oval.svg, no object-fit —
 * browsers stretch an <img> to its box by default, and the SVG itself
 * has preserveAspectRatio="none", so animating the box's height from a
 * flat 41:23 oval to a 41:41 square *is* the flatten/unflatten effect —
 * no separate scale trick needed, Josh's asset already does it).
 */

const COIN_WIDTH_PCT = 51.25 // 41/80 — constant across every state

// Idle / final resting spots, reused by the static (non-animated) states.
const IDLE_LEFT_PCT = 23.75 // 19/80
const IDLE_TOP_PCT = 61.8 // 89/144
const IDLE_HEIGHT_PCT = 15.97 // 23/144 — flattened oval

const REST_LEFT_PCT = 23.75 // 19/80
const REST_TOP_PCT = 35.4 // 51/144
const REST_HEIGHT_PCT = 28.47 // 41/144 — square

/** The still, unflipped coin shown in slots the round hasn't reached yet. */
export function CoinIdle() {
  return (
    <img
      src={coinOval}
      alt=""
      className="absolute"
      style={{ left: `${IDLE_LEFT_PCT}%`, top: `${IDLE_TOP_PCT}%`, width: `${COIN_WIDTH_PCT}%`, height: `${IDLE_HEIGHT_PCT}%` }}
    />
  )
}

/** The settled, resolved coin — same spot CoinFlipHand's own animation
 * ends at, so the handoff between them is seamless. */
export function CoinResult({ face }: { face: CoinFace }) {
  return (
    <div
      className="absolute"
      style={{ left: `${REST_LEFT_PCT}%`, top: `${REST_TOP_PCT}%`, width: `${COIN_WIDTH_PCT}%`, height: `${REST_HEIGHT_PCT}%` }}
    >
      <img src={coinOval} alt="" className="absolute inset-0 h-full w-full" />
      <span className="absolute inset-0 flex items-center justify-center font-body text-sm font-bold text-fg">
        {face === 'heads' ? 'H' : 'T'}
      </span>
    </div>
  )
}

// Shared timeline (fractions of the 'flipping' phase). Extra closely-spaced
// pairs (e.g. 0.179/0.18) exist purely to fake Josh's "instant swap, no
// crossfade" hand changes — two keyframes a hair apart read as a hard cut,
// not a fade, while still fitting Framer Motion's single shared `times`
// array (every animated property below must have one value per entry here).
const TIMES = [0, 0.15, 0.179, 0.18, 0.45, 0.499, 0.5, 0.8, 0.88, 0.95, 1]

// Coin box, keyed to the same TIMES indices:
//  0=idle/prep-start 1=prep-end 2=just-before-flick 3=flick-start
//  4=flick-mid(-flight) 5=just-before-open 6=open/peak 7=catch(impact)
//  8=catch-recenter(settled) 9=hold 10=final
const COIN_LEFT = [23.75, 23.75, 23.75, 23.75, 21.0, 34.45, 34.45, 25.0, 23.75, 23.75, 23.75]
const COIN_TOP = [61.8, 52.8, 52.8, 52.8, 13.2, 2.6, 2.6, 45.1, 35.4, 35.4, 35.4]
const COIN_HEIGHT = [15.97, 15.97, 15.97, 15.97, 15.97, 15.97, 15.97, 28.47, 28.47, 28.47, 28.47]
// Counterclockwise (negative, standard CSS rotate direction) during the
// rise only — unwound back to upright by Catch so the result label sits
// straight, not spinning through the fall too.
const COIN_ROTATE = [0, 0, 0, 0, -43.26, -91.61, -91.61, 0, 0, 0, 0]

const HAND_PREP_OPACITY = [0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0]
const HAND_PREP_TOP = [51.4, 43.1, 43.1, 43.1, 43.1, 43.1, 43.1, 43.1, 43.1, 43.1, 43.1]

const HAND_FLICK_OPACITY = [0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0]
// Keeps rising toward Open's own start position while it's the visible
// layer — "the flicking hand moves towards its next position" — so the
// swap into Open at the peak is a position-continuous, image-only cut.
const HAND_FLICK_TOP = [36.8, 36.8, 36.8, 36.8, 32.0, 28.5, 28.5, 28.5, 28.5, 28.5, 28.5]

const HAND_OPEN_OPACITY = [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0]
const HAND_OPEN_TOP = [28.5, 28.5, 28.5, 28.5, 28.5, 28.5, 28.5, 40.3, 27.8, 27.8, 27.8]

function pct(values: number[]): string[] {
  return values.map((v) => `${v}%`)
}

interface HandLayerProps {
  fill: string
  lines: string
  opacityKeyframes: number[]
  topKeyframes: number[]
  widthPct: number
  heightPct: number
  rotateDeg?: number
  duration: number
}

function HandLayer({ fill, lines, opacityKeyframes, topKeyframes, widthPct, heightPct, rotateDeg, duration }: HandLayerProps) {
  return (
    <motion.div
      className="absolute left-0"
      style={{ width: `${widthPct}%`, height: `${heightPct}%`, rotate: rotateDeg ?? 0 }}
      initial={{ opacity: opacityKeyframes[0], top: `${topKeyframes[0]}%` }}
      animate={{ opacity: opacityKeyframes, top: pct(topKeyframes) }}
      transition={{ duration, times: TIMES, ease: 'linear' }}
    >
      <img src={fill} alt="" className="absolute inset-0 h-full w-full object-contain" />
      <img src={lines} alt="" className="absolute inset-0 h-full w-full object-contain" />
    </motion.div>
  )
}

interface CoinFlipHandProps {
  phaseDurationMs: number
}

/**
 * The Prep → Flick → Open → Catch hand-and-coin sequence for the
 * currently-flipping slot, translating Josh's CoinDisplaySet reference in
 * Figma (CoinDisplayIdle through CoinDisplayFinalResult). One shared
 * timeline drives every layer, so the hand swaps and the coin's
 * position/height/rotation all stay in sync without separate timers —
 * purely a client-side flourish over the existing 'flipping' phase.
 *
 * Ends on a settled, square, *blank* coin at the same spot CoinResult
 * renders — the actual face isn't known client-side until the phase
 * resolves (see Flip.face's doc comment), so the letter appears a beat
 * later when CoinRow swaps this slot to CoinResult. Deliberate, not a
 * gap — matches the physical pause between catching a coin and looking
 * at it.
 */
export function CoinFlipHand({ phaseDurationMs }: CoinFlipHandProps) {
  const duration = phaseDurationMs / 1000
  const transition = { duration, times: TIMES, ease: 'linear' as const }

  return (
    <div className="relative h-full w-full overflow-hidden">
      <HandLayer fill={handPrepFill} lines={handPrepLines} opacityKeyframes={HAND_PREP_OPACITY} topKeyframes={HAND_PREP_TOP} widthPct={105} heightPct={58.3} duration={duration} />
      <HandLayer fill={handFlickFill} lines={handFlickLines} opacityKeyframes={HAND_FLICK_OPACITY} topKeyframes={HAND_FLICK_TOP} widthPct={100} heightPct={55.6} duration={duration} />
      <HandLayer fill={handOpenFill} lines={handOpenLines} opacityKeyframes={HAND_OPEN_OPACITY} topKeyframes={HAND_OPEN_TOP} widthPct={100} heightPct={55.6} rotateDeg={10.73} duration={duration} />

      <motion.img
        src={coinOval}
        alt=""
        className="absolute"
        style={{ width: `${COIN_WIDTH_PCT}%` }}
        initial={{ left: `${COIN_LEFT[0]}%`, top: `${COIN_TOP[0]}%`, height: `${COIN_HEIGHT[0]}%`, rotate: COIN_ROTATE[0] }}
        animate={{ left: pct(COIN_LEFT), top: pct(COIN_TOP), height: pct(COIN_HEIGHT), rotate: COIN_ROTATE }}
        transition={transition}
      />
    </div>
  )
}
