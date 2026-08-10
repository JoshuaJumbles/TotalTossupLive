import { motion } from 'framer-motion'
import handPrepFill from '../assets/coin-hand/hand-prep-fill.png'
import handPrepLines from '../assets/coin-hand/hand-prep-lines.png'
import handFlickFill from '../assets/coin-hand/hand-flick-fill.png'
import handFlickLines from '../assets/coin-hand/hand-flick-lines.png'
import handOpenFill from '../assets/coin-hand/hand-open-fill.png'
import handOpenLines from '../assets/coin-hand/hand-open-lines.png'
import coinOval from '../assets/coin-hand/coin-oval.svg'

interface CoinFlipHandProps {
  phaseDurationMs: number
  /** pendingFlip's sequenceIndex — restarts the whole sequence each flip,
   * same pattern the plain spin used before it. */
  flipKey: number
}

// Shared timeline (fractions of the 'flipping' phase) every layer below
// keys off, so the hand swaps and the coin's arc/spin/squash all stay in
// sync without separate timers. Boundaries: prep holds to ~0.18, a quick
// crossfade into flick, flight to the peak around 0.48, a second crossfade
// into open, fall and land by ~0.84, then a settled beat before the phase
// actually ends. See Josh's CoinFrameExample in Figma for the three
// reference heights (prep/peak/landing) this scales down from — kept
// compact (a small hop, not the full CoinFrame-height spectacle shown
// there) since it plays inside CoinRow's existing ~40px slot alongside
// the other 4, not as its own big scene (Josh's explicit call).
const TIMES = [0, 0.16, 0.2, 0.46, 0.5, 0.82, 0.86, 1]

const HAND_OPACITY = {
  prep: [1, 1, 0, 0, 0, 0, 0, 0],
  flick: [0, 0, 1, 1, 0, 0, 0, 0],
  open: [0, 0, 0, 0, 1, 1, 0, 0],
}

// px, negative = up. A small hop, not the reference's full-frame arc.
const COIN_Y = [0, 0, -3, -9, -9, -3, 0, 0]
// deg, a small toss wobble on the way up/down.
const COIN_ROTATE = [0, 0, -12, 8, 4, 0, 0, 0]
// deg on the Y axis — the actual tumble, same rotateY technique the old
// plain spin used, just eased into a start/stop instead of one constant spin.
const COIN_ROTATE_Y = [0, 0, 180, 900, 1260, 1440, 1440, 1440]
// Flattened-oval look in flight, easing to a full circle as it lands —
// Josh's own side-note idea for suggesting the flip via scale.
const COIN_SCALE_X = [0.55, 0.55, 0.7, 0.85, 0.85, 0.75, 1, 1]

function HandLayer({
  fill,
  lines,
  opacityKeyframes,
  duration,
}: {
  fill: string
  lines: string
  opacityKeyframes: number[]
  duration: number
}) {
  return (
    <motion.div
      className="absolute inset-0"
      initial={{ opacity: opacityKeyframes[0] }}
      animate={{ opacity: opacityKeyframes }}
      transition={{ duration, times: TIMES, ease: 'linear' }}
    >
      <img src={fill} alt="" className="absolute inset-0 h-full w-full object-contain" />
      <img src={lines} alt="" className="absolute inset-0 h-full w-full object-contain" />
    </motion.div>
  )
}

/**
 * The Prep → Flick → Open hand sequence behind the currently-flipping
 * coin, translating Josh's CoinFrameExample reference in Figma. Purely a
 * client-side flourish layered over the existing 'flipping' phase — no
 * new phase or server timing, restarts each flip via the parent's `key`
 * prop (same as the plain spin it replaces).
 *
 * The face value itself isn't known client-side until the phase actually
 * resolves (see Flip.face's doc comment in shared/family.ts — withheld
 * from broadcast until phaseEndsAt), so this animation deliberately ends
 * on a settled, unflattened, *blank* coin. The letter appears a beat
 * later when CoinRow swaps this slot to the real resolved-flip circle —
 * matches the physical pause between catching a coin and looking at it.
 */
export function CoinFlipHand({ phaseDurationMs }: CoinFlipHandProps) {
  const duration = phaseDurationMs / 1000
  const transition = { duration, times: TIMES, ease: 'linear' as const }

  return (
    <div className="relative h-full w-full">
      <HandLayer fill={handPrepFill} lines={handPrepLines} opacityKeyframes={HAND_OPACITY.prep} duration={duration} />
      <HandLayer fill={handFlickFill} lines={handFlickLines} opacityKeyframes={HAND_OPACITY.flick} duration={duration} />
      <HandLayer fill={handOpenFill} lines={handOpenLines} opacityKeyframes={HAND_OPACITY.open} duration={duration} />

      <motion.img
        src={coinOval}
        alt=""
        className="absolute left-1/2 top-1/2 h-[55%] w-[70%] -translate-x-1/2 -translate-y-1/2"
        style={{ transformStyle: 'preserve-3d' }}
        initial={{ y: COIN_Y[0], rotate: COIN_ROTATE[0], rotateY: COIN_ROTATE_Y[0], scaleX: COIN_SCALE_X[0] }}
        animate={{ y: COIN_Y, rotate: COIN_ROTATE, rotateY: COIN_ROTATE_Y, scaleX: COIN_SCALE_X }}
        transition={transition}
      />
    </div>
  )
}
