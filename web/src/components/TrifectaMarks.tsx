import type { Side, TrifectaNightState } from '@total-tossup-live/shared'
import strikethroughInk from '../assets/cross-out/strikethrough-ink.png'

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

interface TrifectaMarksProps {
  nightState: TrifectaNightState
  layout: TrifectaMarkLayout
}

/**
 * Every destroyed target, crossed off on the scene. A Trifecta Night ends
 * when one side's nine are all marked, so this is the actual scoreboard
 * as much as it is decoration.
 *
 * Still the plain settled strikethrough for every mark, including the
 * ones that just landed -- sequencing a round's two or three marks
 * through CrossOutMark's hand-drawn reveal is the next step, and
 * `nightState.destroyed` already records them in order (so "which landed
 * this round" is a suffix slice) precisely so that step needs no state
 * change when it arrives.
 */
export function TrifectaMarks({ nightState, layout }: TrifectaMarksProps) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {(['humans', 'demons'] as Side[]).flatMap((side) =>
        nightState.destroyed[side].map((targetIndex) => {
          const mark = layout[side][targetIndex]
          // A Sheet whose art hasn't caught up with its target count draws
          // nothing rather than crashing, same guard TeamworkBars uses.
          if (!mark) return null
          return (
            <div
              key={`${side}-${targetIndex}`}
              className="absolute"
              style={{
                left: pct(mark.leftPx, SCENE_WIDTH),
                top: pct(mark.topPx, SCENE_HEIGHT),
                width: pct(mark.sizePx, SCENE_WIDTH),
                height: pct(mark.sizePx, SCENE_HEIGHT),
              }}
            >
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
