import { forwardRef } from 'react'
import handDrawFill from '../assets/cross-out/hand-draw-fill.png'
import handDrawLines from '../assets/cross-out/hand-draw-lines.png'
import handBlueCrayon from '../assets/cross-out/hand-blue-crayon.png'

/**
 * How big the hand draws, as a percentage of the scene's own width.
 *
 * This is the whole point of the component existing separately from the
 * mark: it is ONE hand, so it renders at one size no matter what it's
 * drawing. The previous CrossOutMark sized the hand as a fraction of the
 * mark's own box, which meant the same hand rendered at roughly 13px over
 * an upper arm and 52px over the torso -- a 4x swing with no physical
 * justification. Being a percentage of the container also means it needs
 * no measurement pass: it scales with the Sheet automatically.
 */
const HAND_WIDTH_PCT = 15

/**
 * Where the crayon's nib sits inside the hand art, as a fraction of the
 * image's own box -- the point the ink actually leaves, which is what has
 * to land on the path.
 *
 * Measured off hand-blue-crayon.png's alpha channel rather than
 * eyeballed. That art is two disconnected pieces, because the fingers
 * occlude the middle of the crayon: a large body at x 59-249 (lower
 * left) and a small nib at x 295-364 (upper right), whose far point sits
 * at 362,120 of the 420x420 box. The nib is the SMALL piece -- it's the
 * end held between the two front guiding fingers, per Joshua, and the
 * larger lower-left piece is the crayon's back end.
 */
const TIP_X_PCT = 85.5
const TIP_Y_PCT = 29

/**
 * The most the hand tilts away from upright, in degrees.
 *
 * Tracking the stroke's tangent outright made the hand swing wildly on
 * these marks, which reverse direction constantly -- Joshua's call was to
 * damp it to a slight wrist movement. Set this to 0 to lock the hand
 * fully upright; see TrifectaMarks for how the tangent maps into it.
 */
const MAX_TILT_DEG = 15

/** How quickly the tilt chases its target, per frame. Low enough that the
 * jitter in a hand-drawn path can't make the hand buzz, high enough that
 * the wrist still reads as responding to the stroke. */
const TILT_SMOOTHING = 0.12

interface DrawingHandProps {
  /** Mirrors whichever side's color the mark is drawn in -- the crayon art
   * only exists in blue, so the red one is still the hue-rotate the
   * original CrossOutMark used. */
  isRed: boolean
}

/**
 * The hand that draws a mark, positioned imperatively by whoever owns the
 * animation frame loop (see TrifectaMarks): that parent writes `left`,
 * `top`, `rotate` and `opacity` straight onto this element's style every
 * frame rather than re-rendering React at 60fps.
 *
 * Exported constants above are read by that parent so the tip offset and
 * the hand's own size stay defined in one place.
 */
export const DrawingHand = forwardRef<HTMLDivElement, DrawingHandProps>(function DrawingHand(
  { isRed },
  ref,
) {
  return (
    <div
      ref={ref}
      className="pointer-events-none absolute"
      style={{
        width: `${HAND_WIDTH_PCT}%`,
        // Set by the frame loop; starts hidden so a mark that never
        // animates (every settled one) shows no hand at all.
        opacity: 0,
        transformOrigin: `${TIP_X_PCT}% ${TIP_Y_PCT}%`,
      }}
    >
      {/* The three layers are the original Figma stack: a solid fill under
       * line art, with the crayon on top so it reads as held rather than
       * drawn behind the fingers. */}
      <img src={handDrawFill} alt="" className="block w-full" />
      <img src={handDrawLines} alt="" className="absolute inset-0 block w-full" />
      <img
        src={handBlueCrayon}
        alt=""
        className="absolute inset-0 block w-full"
        style={isRed ? { filter: 'hue-rotate(145deg)' } : undefined}
      />
    </div>
  )
})

export const HAND_GEOMETRY = {
  widthPct: HAND_WIDTH_PCT,
  tipXPct: TIP_X_PCT,
  tipYPct: TIP_Y_PCT,
  maxTiltDeg: MAX_TILT_DEG,
  tiltSmoothing: TILT_SMOOTHING,
}
