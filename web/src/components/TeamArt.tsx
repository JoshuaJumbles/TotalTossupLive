import type { Side } from '@total-tossup-live/shared'
import humanFill from '../assets/units/human-fill.png'
import humanLines from '../assets/units/human-lines.png'
import demonFill from '../assets/units/demon-fill.png'
import demonLines from '../assets/units/demon-lines.png'
import { maskStyle } from '../lib/maskStyle'

const FILL_ART: Record<Side, string> = { humans: humanFill, demons: demonFill }
const LINE_ART: Record<Side, string> = { humans: humanLines, demons: demonLines }
const FILL_COLOR_CLASS: Record<Side, string> = { humans: 'bg-humans-fill', demons: 'bg-demons-fill' }
const LINE_COLOR_CLASS: Record<Side, string> = { humans: 'bg-humans-line', demons: 'bg-demons-line' }

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
 * already proven for the coin-flip hand and CrossOutMark: both layers are
 * solid silhouettes used purely for their alpha (see maskStyle) — the
 * fill layer over a bg-humans-fill/demons-fill div, the line layer over
 * its own separate bg-humans-line/demons-line div — so line and fill
 * each read the live color scheme independently. The line no longer
 * stays fixed black; Josh's own call, for schemes where an outline color
 * other than black reads better (see Midnight, where the fill matches
 * the background and only the tinted line is visible at all).
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
      <div className={`absolute inset-0 ${FILL_COLOR_CLASS[side]}`} style={maskStyle(FILL_ART[side])} />
      <div className={`absolute inset-0 ${LINE_COLOR_CLASS[side]}`} style={maskStyle(LINE_ART[side])} />
    </div>
  )
}
