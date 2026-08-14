import type { Side, WeekResult } from '@total-tossup-live/shared'

interface SeasonIndicatorFrameProps {
  weeksPerSeason: number
  currentWeekNumber: number
  completedWeeks: WeekResult[]
}

const WEEK_COLOR_CLASS: Record<Side, string> = { humans: 'bg-humans', demons: 'bg-demons' }

/**
 * Figma's SeasonIndicatorFrame — a small symbolic version of the Season
 * Overview screen's week tally: one rectangle per Week, color-coded for
 * whichever side won it (unplayed weeks stay neutral gray — Figma's own
 * #c0c0c0, deliberately distinct from the lighter --color-card behind it
 * so an unplayed cell still reads as a cell), with ActiveWeekIndicator's
 * outer ring on whichever Week is running right now.
 *
 * Count is weeksPerSeason, not hardcoded to 6 — Josh's own flexible-week-
 * count edge case (e.g. the battle channel's 1-week season): a shorter
 * season just renders fewer, wider rectangles rather than needing any
 * special-casing here.
 */
export function SeasonIndicatorFrame({ weeksPerSeason, currentWeekNumber, completedWeeks }: SeasonIndicatorFrameProps) {
  const resultByWeek = new Map(completedWeeks.map((w) => [w.weekNumber, w.winner]))
  const weeks = Array.from({ length: weeksPerSeason }, (_, i) => i + 1)

  return (
    <div className="flex w-full gap-1.5">
      {weeks.map((weekNumber) => {
        const winner = resultByWeek.get(weekNumber)
        const isActive = weekNumber === currentWeekNumber

        return (
          <div
            key={weekNumber}
            className={`flex-1 border ${isActive ? 'border-fg' : 'border-transparent'}`}
            style={{ padding: 2 }}
          >
            <div
              className={`flex h-5 items-center justify-center border-2 border-fg font-body text-xs text-fg ${winner ? WEEK_COLOR_CLASS[winner] : 'bg-[#c0c0c0]'}`}
            >
              W{weekNumber}
            </div>
          </div>
        )
      })}
    </div>
  )
}
