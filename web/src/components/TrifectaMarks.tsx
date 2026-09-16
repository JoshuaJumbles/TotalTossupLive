import type { Side, TrifectaNightState } from '@total-tossup-live/shared'
import strikethroughInk from '../assets/cross-out/strikethrough-ink.png'
import { CrossOutMark } from './CrossOutMark'

/** One destroyable target's own box on the scene -- real pixel positions
 * in the Sheet's own 409-wide scene frame, exactly the convention
 * TeamworkBars' cell geometry uses. */
export interface TrifectaMarkGeometry {
  leftPx: number
  topPx: number
  sizePx: number
}

/** Each side's nine target boxes, index-aligned with that side's own
 * config.targets array -- so a destroyed target index looks its position
 * up directly, with no separate mapping to keep in sync. */
export type TrifectaMarkLayout = Record<Side, TrifectaMarkGeometry[]>

const SCENE_WIDTH = 409
const SCENE_HEIGHT = 315

function pct(px: number, of: number): string {
  return `${(px / of) * 100}%`
}

/** Whoever crossed this target off is the *other* side -- a human target
 * is marked in demons' color and vice versa, matching the physical
 * game's own pen convention (and CrossOutMark/TeamworkBars before it). */
const MARK_COLOR: Record<Side, string> = {
  humans: 'var(--color-demons)',
  demons: 'var(--color-humans)',
}
const MARK_COLOR_CLASS: Record<Side, 'text-demons' | 'text-humans'> = {
  humans: 'text-demons',
  demons: 'text-humans',
}

interface TrifectaMarksProps {
  nightState: TrifectaNightState
  layout: TrifectaMarkLayout
  /** The pause this round landed in, if it's one where the marks that
   * just fell should be drawn rather than simply shown settled. Undefined
   * (or 0) anywhere else, including every later render of the same
   * resolved round. */
  phaseDurationMs?: number
}

/**
 * Every destroyed target, crossed off on the scene. A Trifecta Night ends
 * when one side's nine are all marked, so this is the actual scoreboard
 * as much as it is decoration.
 *
 * The marks that landed *this* round play CrossOutMark's hand-drawn
 * reveal, one after another rather than all at once -- a round can
 * destroy up to three targets, and three hands drawing simultaneously
 * would read as noise rather than as a flurry. Which marks those are
 * comes straight off nightState.lastRound (server-computed and
 * broadcast), so it survives a viewer reconnecting mid-pause instead of
 * depending on the client having seen the previous snapshot.
 *
 * Each mark gets an equal slice of whatever pause window it's given, and
 * the coordinator has already widened that window in proportion (see
 * FlipOutcome.pauseScale) -- so a triple runs three full-speed reveals
 * back to back rather than three rushed ones. Dividing the window here
 * rather than assuming a fixed per-mark length is also what lets a
 * killing blow animate correctly inside the longer night_won pause with
 * no special-casing.
 */
export function TrifectaMarks({ nightState, layout, phaseDurationMs }: TrifectaMarksProps) {
  const lastRound = nightState.lastRound
  const revealing = !!phaseDurationMs && !!lastRound && lastRound.targets.length > 0
  const sliceMs = revealing ? (phaseDurationMs ?? 0) / lastRound!.targets.length : 0

  return (
    <div className="pointer-events-none absolute inset-0">
      {(['humans', 'demons'] as Side[]).flatMap((side) =>
        nightState.destroyed[side].map((targetIndex) => {
          const mark = layout[side][targetIndex]
          // A Sheet whose art hasn't caught up with its target count draws
          // nothing rather than crashing, same guard TeamworkBars uses.
          if (!mark) return null

          // Where this target sits in the round that just landed, if it
          // was part of it at all -- which decides both whether it
          // animates and how far back in the queue it starts.
          const revealIndex =
            revealing && lastRound!.side === side ? lastRound!.targets.indexOf(targetIndex) : -1

          const box = {
            left: pct(mark.leftPx, SCENE_WIDTH),
            top: pct(mark.topPx, SCENE_HEIGHT),
            width: pct(mark.sizePx, SCENE_WIDTH),
            height: pct(mark.sizePx, SCENE_HEIGHT),
          }

          if (revealIndex >= 0) {
            return (
              <div key={`${side}-${targetIndex}`} className="absolute" style={box}>
                <CrossOutMark
                  markColorClass={MARK_COLOR_CLASS[side]}
                  phaseDurationMs={sliceMs}
                  delayMs={sliceMs * revealIndex}
                />
              </div>
            )
          }

          return (
            <div key={`${side}-${targetIndex}`} className="absolute" style={box}>
              <div
                className="absolute inset-0"
                style={{
                  backgroundColor: MARK_COLOR[side],
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
        }),
      )}
    </div>
  )
}
