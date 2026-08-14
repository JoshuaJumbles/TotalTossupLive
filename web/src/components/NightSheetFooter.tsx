import type { ChannelSnapshot, SeasonStreak, Side } from '@total-tossup-live/shared'
import { SeasonIndicatorFrame } from './SeasonIndicatorFrame'

/** The HUMANS/DEMONS captions + big week score + SeasonIndicatorFrame,
 * shared by every Night Sheet visual regardless of style ('simple' or
 * 'battle') — this part of the layout doesn't change with the Sheet's
 * presentation. Champion/Challenger replaced with "N-Season Win Streak"
 * (Josh's own call — the coin-flip drama is in recent momentum, not
 * lifetime record) — scoped to the Night Sheet only for now; the other
 * screens' MatchupHeader keeps Champion/Challenger.
 *
 * "N Season Pts" and "Week N" both dropped (Josh's own tidying pass) —
 * SeasonIndicatorFrame already shows the season's status at a glance, so
 * the numeric points/week labels were redundant with it. */
export function NightSheetFooter({ snapshot }: { snapshot: ChannelSnapshot }) {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      {/* Grid, not flex: a streak line only ever shows on one side (or
       * neither), so the two TeamCaptions are almost never the same width
       * or height. minmax(0,1fr) on the outer columns forces them to stay
       * exactly equal width regardless of which one's content is wider —
       * that symmetry is what keeps the score's own column dead center
       * (a flex row centers by total content width, so an off-balance
       * side would drag the whole block, and score along with it, off
       * center — grid's middle column doesn't care what either side's
       * width is). items-start keeps both team names pinned to the same
       * top edge instead of being vertically centered against whichever
       * side happens to be taller at the moment. */}
      <div className="grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start justify-items-center gap-2 sm:gap-4">
        <TeamCaption side="humans" streak={snapshot.seasonStreak} />
        <p className="font-display text-5xl text-fg sm:text-6xl">
          {snapshot.weekScore.humans} : {snapshot.weekScore.demons}
        </p>
        <TeamCaption side="demons" streak={snapshot.seasonStreak} />
      </div>

      <SeasonIndicatorFrame
        weeksPerSeason={snapshot.weeksPerSeason}
        currentWeekNumber={snapshot.weekNumber}
        completedWeeks={snapshot.completedWeeks}
      />
    </div>
  )
}

function TeamCaption({ side, streak }: { side: Side; streak: SeasonStreak }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <p className="font-display text-xl uppercase text-fg sm:text-2xl">{side}</p>
      {/* Only the side currently on the streak shows a line here — works
       * from 1+, nothing shown for either side before any Season has ever
       * closed (streak.side is null) or for the side not on it. */}
      {streak.side === side && (
        <p className="whitespace-nowrap font-body text-[11px] text-fg">
          {streak.length}-Season Win Streak
        </p>
      )}
    </div>
  )
}
