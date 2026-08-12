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
 * rendered box — one of 5 equal columns filling CoinFrame's full height
 * (80×144 in Figma). CSS percentages resolve against whatever real size
 * the column gets automatically, so this holds proportions at any device
 * size with no JS measurement needed.
 *
 * The keyframe data itself comes straight from Josh's CoinDisplayFigmaMotion
 * frame — pulled via Figma's get_motion_context tool (real per-property
 * easing curves and keyframe tracks, not hand-timed guesses from static
 * reference frames like the previous version). Each property below keeps
 * its own `times`/`ease` because that's what Figma actually authored —
 * opacity, position, and rotation don't share one timeline in the source,
 * so flattening them into one shared array would lose real intent.
 *
 * One deliberate deviation from the source: Figma's own timeline fades in
 * the result LETTER at ~80% through the sequence. This app can't do that
 * — the face value isn't known client-side until the phase actually
 * resolves at 100% (see Flip.face's doc comment) — so the coin still
 * settles into its final, squared shape on Figma's schedule, just staying
 * blank until CoinRow swaps this slot to the real CoinResult right at the
 * end. Matches the physical pause between catching a coin and looking at
 * it, same reasoning as before.
 */

const COIN_WIDTH_PCT = 51.25 // 41/80 — constant across every state
const COIN_BASE_HEIGHT_PCT = 15.97 // 23/144 — the coin's own box never
// resizes; only `scaleY` (a transform, see PreppedCoin below) changes how
// flat or round it looks, exactly like Josh's Figma layers.

const IDLE_LEFT_PCT = 23.75 // 19/80
const IDLE_TOP_PCT = 65.28 // 94/144 — the coin's resting/idle spot

// CoinResult is static (no scaleY transform), so it uses an explicit
// height instead — computed to land on the exact same visual top edge
// the animated coin's scaleY:2 (grows from center) ends up at, so the
// handoff between CoinFlipHand's last frame and CoinResult is seamless.
const REST_LEFT_PCT = 23.75
const REST_TOP_PCT = 37.85
const REST_HEIGHT_PCT = 31.94

/** The still, unflipped coin shown in slots the round hasn't reached yet. */
export function CoinIdle() {
  return (
    <img
      src={coinOval}
      alt=""
      className="absolute"
      style={{ left: `${IDLE_LEFT_PCT}%`, top: `${IDLE_TOP_PCT}%`, width: `${COIN_WIDTH_PCT}%`, height: `${COIN_BASE_HEIGHT_PCT}%` }}
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

type Ease = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut'

interface CoinFlipHandProps {
  phaseDurationMs: number
}

/**
 * The Prep → Flick → Open → Catch hand-and-coin sequence for the
 * currently-flipping slot, matching Josh's CoinDisplayFigmaMotion
 * timeline exactly (2 full counterclockwise coin rotations during
 * flight, a 24-point sampled arc for the coin's rise/fall/bounce, the
 * hand's own catch-impact dip and recover). One `duration` (the real
 * phaseDurationMs) scales every property's timeline uniformly since they
 * all share the same 0–1 fraction convention Figma exported — nothing
 * here is a fixed number of seconds.
 */
export function CoinFlipHand({ phaseDurationMs }: CoinFlipHandProps) {
  const duration = phaseDurationMs / 1000

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* HandPrep — fades in and rises, fades back out well before Flick
       * takes over (Figma's own timing: a quick in-and-out within the
       * first ~16% of the flip, not a hold-until-swap). */}
      <motion.div
        className="absolute"
        style={{ left: '0%', width: '105%', height: '58.33%' }}
        initial={{ opacity: 0, top: '55.56%' }}
        animate={{ opacity: [0, 0.40627, 0.72801, 0.94451, 0, 0], top: ['55.56%', '41.67%', '41.67%'] }}
        transition={{
          opacity: { duration, times: [0, 0.0408, 0.0817, 0.1225, 0.1634, 1], ease: 'linear' },
          top: { duration, times: [0, 0.1509, 1], ease: ['easeIn', 'linear'] as Ease[] },
        }}
      >
        <img src={handPrepFill} alt="" className="absolute inset-0 h-full w-full object-contain" />
        <img src={handPrepLines} alt="" className="absolute inset-0 h-full w-full object-contain" />
      </motion.div>

      {/* HandFlick — a small 4px rise while visible, handing off to Open
       * right as it fades. */}
      <motion.div
        className="absolute"
        style={{ left: '2.5%', width: '100%', height: '55.56%' }}
        initial={{ opacity: 0, top: '41.67%' }}
        animate={{ opacity: [0, 0, 1, 1, 0, 0], top: ['41.67%', '41.67%', '38.89%', '38.89%'] }}
        transition={{
          opacity: { duration, times: [0, 0.1509, 0.1602, 0.4011, 0.4123, 1], ease: ['linear', 'easeOut', 'linear', 'easeOut', 'linear'] as Ease[] },
          top: { duration, times: [0, 0.1601, 0.255, 1], ease: ['linear', 'easeOut', 'linear'] as Ease[] },
        }}
      >
        <img src={handFlickFill} alt="" className="absolute inset-0 h-full w-full object-contain" />
        <img src={handFlickLines} alt="" className="absolute inset-0 h-full w-full object-contain" />
      </motion.div>

      {/* HandOpen — rises to the catch position, dips down for the
       * impact, springs back up to settle, then fades out well before
       * the coin's own final rest (the hand lets go, coin settles alone). */}
      <motion.div
        className="absolute"
        style={{ width: '100%', height: '55.56%' }}
        initial={{ opacity: 0, left: '-1.25%', top: '45.83%', rotate: -14.324 }}
        animate={{
          opacity: [0, 0, 1, 1, 0, 0],
          left: ['-1.25%', '-1.25%', '3.75%', '3.75%'],
          top: ['45.83%', '45.83%', '37.5%', '37.5%', '51.39%', '37.5%', '37.5%'],
          rotate: [-14.324, -14.324, 1.676, 1.676],
        }}
        transition={{
          opacity: { duration, times: [0, 0.4011, 0.4123, 0.7601, 0.817, 1], ease: ['linear', 'easeOut', 'linear', 'easeOut', 'linear'] as Ease[] },
          left: { duration, times: [0, 0.4123, 0.5294, 1], ease: ['linear', 'easeOut', 'linear'] as Ease[] },
          top: { duration, times: [0, 0.4123, 0.5294, 0.6585, 0.7293, 0.8, 1], ease: ['linear', 'easeOut', 'linear', 'easeOut', 'easeIn', 'linear'] as Ease[] },
          rotate: { duration, times: [0, 0.4123, 0.5951, 1], ease: ['linear', 'easeOut', 'linear'] as Ease[] },
        }}
      >
        <img src={handOpenFill} alt="" className="absolute inset-0 h-full w-full object-contain" />
        <img src={handOpenLines} alt="" className="absolute inset-0 h-full w-full object-contain" />
      </motion.div>

      {/* PreppedCoin — 2 full counterclockwise rotations (720°→0°) during
       * flight, unwound to upright by the time it settles. scaleY (not
       * an explicit height animation) is the flatten↔round effect —
       * grows from center, same as Josh's own layers; the box's own
       * height never changes. The 24-point `top` track is Figma's own
       * sampled arc: rise, peak, fall, a catch dip nearly back to idle
       * height, then a bounce up to the final (higher) rest spot. */}
      <motion.img
        src={coinOval}
        alt=""
        className="absolute"
        style={{ left: `${IDLE_LEFT_PCT}%`, width: `${COIN_WIDTH_PCT}%`, height: `${COIN_BASE_HEIGHT_PCT}%` }}
        initial={{ top: `${IDLE_TOP_PCT}%`, rotate: 720, scaleY: 1 }}
        animate={{
          top: [
            '65.28%', '63.7%', '60.01%', '54.94%', '46.3%', '35.17%', '25.47%', '17.32%',
            '11.09%', '7.43%', '7.57%', '11.41%', '17.78%', '26.04%', '35.83%', '47.05%',
            '51.39%', '60.57%', '63.01%', '54.76%', '46.78%', '46.04%', '45.83%', '45.83%',
          ],
          rotate: [720, 720, 0, 0],
          scaleY: [1, 1, 2, 2],
        }}
        transition={{
          top: {
            duration,
            times: [0, 0.0408, 0.0817, 0.1225, 0.1634, 0.2042, 0.2451, 0.2859, 0.3268, 0.3676, 0.4085, 0.4493, 0.4902, 0.531, 0.5719, 0.6127, 0.6536, 0.6944, 0.7353, 0.7761, 0.817, 0.8578, 0.8987, 1],
            ease: 'linear',
          },
          rotate: { duration, times: [0, 0.1451, 0.6271, 1], ease: 'linear' },
          scaleY: { duration, times: [0, 0.7293, 0.8269, 1], ease: ['linear', 'easeOut', 'linear'] as Ease[] },
        }}
      />
    </div>
  )
}
