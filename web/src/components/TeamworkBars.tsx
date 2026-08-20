import type { Side, TeamworkNightState } from '@total-tossup-live/shared'
import strikethroughInk from '../assets/cross-out/strikethrough-ink.png'
import { CrossOutMark } from './CrossOutMark'

/**
 * The generic Teamwork Family bars renderer -- one component for every
 * Sheet, replacing what used to be a near-duplicate BarricadeBars/
 * CloudFightBars pair. A Sheet supplies its own `layout`: per-icon cell
 * geometry (real pixel positions in Figma's own 409x311 scene frame) plus
 * which side that icon belongs to (decides the mark's color).
 *
 * Rendering is just "for each of the 4 tracks (humans/demons x
 * action/defense), draw each mark at that icon's own cell for its
 * position in the track." A track's own combined mark index is what
 * makes CloudFight's jetpack/bow "handoff" fall out for free -- humans'
 * action track is `['bow', 'jetpack', ...]`, and mapping each entry by
 * its position in *that* array, not a per-icon count, is what makes an
 * icon land on the correct global position number while still drawing on
 * its own icon-specific lane (see barricadeSheetArt.ts/
 * cloudFightSheetArt.ts for both Sheets' own layouts, and Josh's own
 * worked example this was verified against live).
 */
export interface BarCellGeometry {
  leftPx: number
  topPx: number
  sizePx: number
}

/** One icon's own bar geometry: which cells it fills (ordered nearest-to-
 * center/position-1 first, matching how the bar actually fills) and which
 * side owns it, deciding the mark's color. */
export interface TeamworkIconBarGeometry {
  cells: BarCellGeometry[]
  side: Side
}

export type TeamworkBarLayout<TIcon extends string> = Record<TIcon, TeamworkIconBarGeometry>

const SCENE_WIDTH = 409
const SCENE_HEIGHT = 311

function pct(px: number, of: number): string {
  return `${(px / of) * 100}%`
}

function cellPositionStyle(cell: BarCellGeometry) {
  return {
    left: pct(cell.leftPx, SCENE_WIDTH),
    top: pct(cell.topPx, SCENE_HEIGHT),
    width: pct(cell.sizePx, SCENE_WIDTH),
    height: pct(cell.sizePx, SCENE_HEIGHT),
  }
}

function BarCellMark({ cell, markColor }: { cell: BarCellGeometry; markColor: string }) {
  return (
    <div className="absolute" style={cellPositionStyle(cell)}>
      <div
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
      />
    </div>
  )
}

/** The one mark landing right now -- CrossOutMark's own hand-drawn reveal
 * plays once, ending on the exact same settled strikethrough BarCellMark
 * renders directly (same ink asset, same mask-and-tint approach), so
 * there's no visible seam once the animation finishes. CrossOutMark
 * positions its own oversized canvas via negative-percentage insets
 * relative to its immediate parent, so this wrapper just needs to be the
 * cell's own box, same as BarCellMark's -- no extra sizing math. */
function AnimatedBarCellMark({ cell, side, phaseDurationMs }: { cell: BarCellGeometry; side: Side; phaseDurationMs: number }) {
  return (
    <div className="absolute" style={cellPositionStyle(cell)}>
      <CrossOutMark markColorClass={side === 'demons' ? 'text-demons' : 'text-humans'} phaseDurationMs={phaseDurationMs} />
    </div>
  )
}

interface TeamworkBarsProps<TIcon extends string> {
  nightState: TeamworkNightState<TIcon>
  layout: TeamworkBarLayout<TIcon>
  /** The icon this round resolved to, if we're in its round_resolved
   * pause -- see TeamworkNightSheetScreen's own computation (derived
   * client-side via resolveGridCell, not a new broadcast field). Only
   * the one mark this drives (always the newest entry of whichever
   * track it belongs to) plays CrossOutMark's reveal; every other mark,
   * including this same one on every later render, is the plain settled
   * BarCellMark. Null outside round_resolved (or before Josh's own
   * hand-animation pass, for any caller that hasn't wired it up). */
  justResolvedIcon?: TIcon | null
  /** round_resolved's own duration -- see CrossOutMark. Only meaningful
   * alongside justResolvedIcon; ignored otherwise. */
  phaseDurationMs?: number
}

export function TeamworkBars<TIcon extends string>({
  nightState,
  layout,
  justResolvedIcon = null,
  phaseDurationMs = 0,
}: TeamworkBarsProps<TIcon>) {
  // Each of the 4 tracks renders independently -- a track's own marks
  // array index is what decides which cell a mark lands on, regardless
  // of which other tracks exist or how many marks they hold.
  const tracks: TeamworkNightState<TIcon>['humans']['action'][] = [
    nightState.humans.action,
    nightState.humans.defense,
    nightState.demons.action,
    nightState.demons.defense,
  ]

  return (
    <div className="pointer-events-none absolute inset-0">
      {tracks.map((marks, trackIndex) =>
        marks.map((icon, i) => {
          const geometry = layout[icon]
          const cell = geometry.cells[i]
          // A track can in principle out-run its own drawn cells (e.g. a
          // pushed-back target higher than the bar's own art anticipated)
          // -- draw nothing rather than crash.
          if (!cell) return null
          const key = `${trackIndex}-${i}`
          // The newest mark on whichever track just got hit this round
          // is always its own array's last entry -- no separate "which
          // track" lookup needed, since an icon belongs to exactly one
          // track per Sheet (see TeamworkBarLayout's own doc comment).
          const isJustResolved = justResolvedIcon != null && icon === justResolvedIcon && i === marks.length - 1
          if (isJustResolved) {
            return <AnimatedBarCellMark key={key} cell={cell} side={geometry.side} phaseDurationMs={phaseDurationMs} />
          }
          return <BarCellMark key={key} cell={cell} markColor={`var(--color-${geometry.side})`} />
        }),
      )}
    </div>
  )
}
