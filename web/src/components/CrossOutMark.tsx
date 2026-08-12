import { motion } from 'framer-motion'
import handDrawFill from '../assets/cross-out/hand-draw-fill.png'
import handDrawLines from '../assets/cross-out/hand-draw-lines.png'
import handBlueCrayon from '../assets/cross-out/hand-blue-crayon.png'
import strikethroughInk from '../assets/cross-out/strikethrough-ink.png'

/**
 * All positions below are percentages of Figma's own CrossOutAnimation
 * frame (244x244) — same convention as CoinDisplay.tsx, so this scales at
 * any real rendered size with zero JS measurement. The frame is
 * deliberately bigger than the entity it marks (a 176x176 square, 34px
 * margin per side) — room for the hand to swing outside the unit icon's
 * own box without clipping. CANVAS_SCALE/OFFSET blow this component up to
 * that same proportion relative to the unit icon's own `size`, centered
 * over it, rather than fitting snugly inside it.
 */
const CANVAS_SCALE = 244 / 176 // 1.38636 — canvas size relative to the unit icon
const CANVAS_OFFSET_PCT = (34 / 176) * 100 // 19.3182% — negative inset on each side

// StrikethroughMark's ink box, relative to the 244 canvas.
const INK_LEFT_PCT = (28 / 244) * 100
const INK_TOP_PCT = (33 / 244) * 100
const INK_SIZE_PCT = (177 / 244) * 100

// The reveal wipe: Figma's real "StrikethroughMask" rectangle grows from
// 11px to 143px tall (of the ink box's own 177px height) — expressed here
// as an animated clip-path bottom-inset (a simpler, equally faithful
// stand-in for Figma's growing mask-size, since the ink asset already
// carries its own alpha shape for the mask-image below).
const REVEAL_START_BOTTOM_INSET_PCT = 100 - (11 / 177) * 100
const REVEAL_END_BOTTOM_INSET_PCT = 100 - (143 / 177) * 100

// HandDrawBlue's static base position, relative to the 244 canvas — the
// motion track's x/y deltas (added below) land on top of this.
const HAND_BASE_LEFT_PX = -9
const HAND_BASE_TOP_PX = 34
const HAND_WIDTH_PCT = (93 / 244) * 100
const HAND_HEIGHT_PCT = (91 / 244) * 100

function pct(px: number) {
  return `${(px / 244) * 100}%`
}

type Ease = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | [number, number, number, number]

interface CrossOutMarkProps {
  /** Same value already threaded through UnitColumns — 'text-demons' marks
   * a Human unit red (Demons are marking it), 'text-humans' marks a Demon
   * unit blue (Humans are marking it). Reused as-is rather than inventing
   * a second color vocabulary. */
  markColorClass: 'text-demons' | 'text-humans'
  phaseDurationMs: number
}

/**
 * The round_resolved reveal for whichever unit just got crossed off —
 * Josh's Figma 'CrossOutAnimation' frame, pulled via get_motion_context.
 * Plays once (round_resolved's own 3s duration matches the authored
 * timeline exactly) then the caller swaps back to the plain static "✕"
 * for every subsequent render, same as every other already-crossed unit.
 *
 * First pass: fixed strikethrough art (no Strikethrough1-4 randomization
 * yet — Josh's own stretch goal, deferred) and a placeholder red crayon
 * (hue-rotated from the real Hand_BlueCrayon asset — Figma only has the
 * blue variant wired into an example instance; Hand_RedCrayon wasn't
 * discoverable via the API, likely a hidden sibling layer. Trivial to
 * swap once Josh points at the real asset.)
 */
export function CrossOutMark({ markColorClass, phaseDurationMs }: CrossOutMarkProps) {
  const duration = phaseDurationMs / 1000
  const isRed = markColorClass === 'text-demons'
  const markColor = isRed ? 'var(--color-demons)' : 'var(--color-humans)'

  const handX = [28, 0, 0, 120, 12, 132, 24, 144, 144].map((d) => pct(HAND_BASE_LEFT_PX + d))
  const handXTimes = [0, 0.164, 0.2637, 0.3463, 0.4289, 0.5151, 0.6002, 0.6864, 1]
  const handXEase: Ease[] = [
    [0.7, -0.4, 0.4, 1.4],
    'linear',
    'easeInOut',
    'easeInOut',
    'easeInOut',
    'easeInOut',
    'easeInOut',
    'linear',
  ]

  const handY = [52, 0, 0, 24, 48, 72, 96, 120, 120, 128, 128].map((d) => pct(HAND_BASE_TOP_PX + d))
  const handYTimes = [0, 0.164, 0.2637, 0.3463, 0.4289, 0.5151, 0.6002, 0.6864, 0.7439, 0.9106, 1]
  const handYEase: Ease[] = [
    [0.7, -0.4, 0.4, 1.4],
    'linear',
    'easeInOut',
    'easeInOut',
    'easeInOut',
    'easeInOut',
    'easeInOut',
    'linear',
    'easeOut',
    'linear',
  ]

  return (
    <div
      className="pointer-events-none absolute"
      style={{
        left: `${-CANVAS_OFFSET_PCT}%`,
        top: `${-CANVAS_OFFSET_PCT}%`,
        width: `${CANVAS_SCALE * 100}%`,
        height: `${CANVAS_SCALE * 100}%`,
      }}
    >
      {/* Ink — Strikethrough1's own alpha channel used as a colorable
       * mask, so the mark is real markColor rather than the asset's fixed
       * black. clip-path grows this to reveal it top-down. */}
      <div
        className="absolute"
        style={{ left: `${INK_LEFT_PCT}%`, top: `${INK_TOP_PCT}%`, width: `${INK_SIZE_PCT}%`, height: `${INK_SIZE_PCT}%` }}
      >
        <motion.div
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
          initial={{ clipPath: `inset(0 0 ${REVEAL_START_BOTTOM_INSET_PCT}% 0)` }}
          animate={{
            clipPath: [
              `inset(0 0 ${REVEAL_START_BOTTOM_INSET_PCT}% 0)`,
              `inset(0 0 ${REVEAL_START_BOTTOM_INSET_PCT}% 0)`,
              `inset(0 0 ${REVEAL_END_BOTTOM_INSET_PCT}% 0)`,
              `inset(0 0 ${REVEAL_END_BOTTOM_INSET_PCT}% 0)`,
            ],
          }}
          transition={{ duration, times: [0, 0.2637, 0.7178, 1], ease: 'linear' }}
        />
      </div>

      {/* Hand + crayon — draws the mark. */}
      <motion.div
        className="absolute"
        style={{ width: `${HAND_WIDTH_PCT}%`, height: `${HAND_HEIGHT_PCT}%` }}
        initial={{ opacity: 0, left: handX[0], top: handY[0] }}
        animate={{ opacity: [0, 1, 1, 0, 0], left: handX, top: handY }}
        transition={{
          opacity: { duration, times: [0, 0.1667, 0.7822, 0.9488, 1], ease: ['easeOut', 'linear', 'easeOut', 'linear'] as Ease[] },
          left: { duration, times: handXTimes, ease: handXEase },
          top: { duration, times: handYTimes, ease: handYEase },
        }}
      >
        <img src={handDrawFill} alt="" className="absolute inset-0 h-full w-full object-contain" />
        <img src={handDrawLines} alt="" className="absolute inset-0 h-full w-full object-contain" />
        <img
          src={handBlueCrayon}
          alt=""
          className="absolute inset-0 h-full w-full object-contain"
          style={isRed ? { filter: 'hue-rotate(145deg)' } : undefined}
        />
      </motion.div>
    </div>
  )
}
