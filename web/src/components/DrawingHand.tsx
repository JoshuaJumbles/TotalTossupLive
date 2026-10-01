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
 * Where the crayon's drawing tip sits inside the hand art, as a fraction
 * of the image's own box. The art is a fist gripping a crayon that runs
 * diagonally through it, tip pointing down-left, so the tip is well off
 * the image's center and the hand has to be offset by this much for the
 * tip -- rather than the middle of the fist -- to land on the path.
 *
 * Measured off hand-blue-crayon.png's own alpha channel rather than
 * eyeballed: its leftmost opaque pixel (the crayon's point, where ink
 * would actually leave it) is at 59,245 of that image's 420x420 box.
 */
const TIP_X_PCT = 14
const TIP_Y_PCT = 58.3

/**
 * How much of the stroke's own direction the hand takes on, 0 to 1.
 *
 * A real hand doesn't spin to match the stroke -- it holds the pen about
 * the same way and lets the wrist do a little of the work, which is why
 * this is a fraction rather than tracking the tangent outright. At 1.0 a
 * mark drawn right-to-left would render the hand upside down; at 0 the
 * hand reads as a sticker sliding along the line.
 */
const TILT_FACTOR = 0.25

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
  tiltFactor: TILT_FACTOR,
}
