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
      <div className="flex w-full items-center justify-center gap-6 sm:gap-10">
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
