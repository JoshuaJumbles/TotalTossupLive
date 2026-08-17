import type { Side } from '@total-tossup-live/shared'
import humanFill from '../assets/units/human-fill.png'
import humanLines from '../assets/units/human-lines.png'
import demonFill from '../assets/units/demon-fill.png'
import demonLines from '../assets/units/demon-lines.png'

const FILL_ART: Record<Side, string> = { humans: humanFill, demons: demonFill }
const LINE_ART: Record<Side, string> = { humans: humanLines, demons: demonLines }
const FILL_COLOR_CLASS: Record<Side, string> = { humans: 'bg-humans', demons: 'bg-demons' }

interface TeamArtProps {
  side: Side
  /** Merged onto the outer wrapper — a caller's own sizing (e.g. w-40) or
   * flip (scale-x-[-1]) both just work as one transform on the whole
   * figure, fill and lines together. */
  className?: string
}

/**
 * One side's figure, in each side's own color — Josh's fill/line pair
 * export (HumanBasicFill/Lines, DemonBasicFill/Lines), replacing the old
 * fixed-black human-simple/demon-simple.png. Same mask-and-tint technique
 * already proven for the coin-flip hand and CrossOutMark: the fill layer
 * is a solid white silhouette used purely for its alpha (as a CSS mask
 * over a bg-humans/bg-demons div, so it reads the live color scheme like
 * everything else), the line layer sits on top unchanged — always black,
 * same as before.
 *
 * aspect-square + w-full (not h-full) so this drops into either calling
 * shape: UnitColumns' explicitly-both-dimensions-sized wrapper, or
 * TeamPortrait's width-only-with-auto-height one — the source art is a
 * literal 1024x1024 square either way, so aspect-square always recovers
 * the same proportions a plain <img> with only its width set would have
 * gotten from its own intrinsic size.
 */
export function TeamArt({ side, className = '' }: TeamArtProps) {
  return (
    <div className={`relative aspect-square w-full ${className}`}>
      <div
        className={`absolute inset-0 ${FILL_COLOR_CLASS[side]}`}
        style={{
          WebkitMaskImage: `url(${FILL_ART[side]})`,
          maskImage: `url(${FILL_ART[side]})`,
          WebkitMaskSize: 'contain',
          maskSize: 'contain',
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat',
          WebkitMaskPosition: 'center',
          maskPosition: 'center',
        }}
      />
      <img src={LINE_ART[side]} alt="" className="absolute inset-0 h-full w-full object-contain" />
    </div>
  )
}
