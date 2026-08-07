import type { ChannelSnapshot, Side } from '@total-tossup-live/shared'
import { CountdownBar } from './CountdownBar'
import { MatchupHeader } from './MatchupHeader'
import { Wordmark } from './Wordmark'

const ORDINAL_WORDS = [
  'Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven',
  'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen',
]
function ordinalWord(n: number): string {
  return ORDINAL_WORDS[n] ?? String(n)
}

interface SeasonOverviewScreenProps {
  snapshot: ChannelSnapshot
  progress: number
}

export function SeasonOverviewScreen({ snapshot, progress }: SeasonOverviewScreenProps) {
  const weeks = Array.from({ length: snapshot.weeksPerSeason }, (_, i) => i + 1)
  const resultByWeek = new Map(snapshot.completedWeeks.map((w) => [w.weekNumber, w.winner]))

  return (
    <div className="flex w-full flex-col items-center gap-8 text-center">
      <Wordmark />

      <div className="grid w-full max-w-md grid-cols-3 gap-3">
        {weeks.map((weekNumber) => (
          <WeekCard
            key={weekNumber}
            weekNumber={weekNumber}
            winner={resultByWeek.get(weekNumber) ?? null}
            isCurrent={weekNumber === snapshot.weekNumber}
          />
        ))}
      </div>

      <MatchupHeader
        lifetimeRecord={snapshot.lifetimeRecord}
        showLifetimeWinCount={false}
        center={
          <div className="flex flex-col items-center gap-1">
            <p className="font-body text-sm font-light uppercase text-fg">Season Score</p>
            <p className="font-display text-6xl text-fg sm:text-7xl">
              {snapshot.seasonScore.humans} : {snapshot.seasonScore.demons}
            </p>
          </div>
        }
      />

      <div className="flex flex-col items-center gap-2">
        <p className="font-body text-2xl font-bold uppercase text-fg">Week {ordinalWord(snapshot.weekNumber)}</p>
        <p className="font-body text-lg text-fg">Starts in</p>
        <div className="mt-2 w-64">
          <CountdownBar progress={progress} />
        </div>
      </div>
    </div>
  )
}

function WeekCard({
  weekNumber,
  winner,
  isCurrent,
}: {
  weekNumber: number
  winner: Side | null
  isCurrent: boolean
}) {
  const bg = winner === 'humans' ? 'bg-humans' : winner === 'demons' ? 'bg-demons' : 'bg-card'
  const textColor = winner ? 'text-white' : 'text-fg'

  return (
    <div
      className={`relative flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg border-4 border-fg p-2 ${bg} ${
        isCurrent ? 'outline outline-4 -outline-offset-8 outline-dashed outline-fg' : ''
      }`}
    >
      <p className={`font-body text-base font-bold leading-tight ${textColor}`}>Week</p>
      <p className={`font-body text-base font-bold leading-tight ${textColor}`}>{ordinalWord(weekNumber)}</p>
      {!winner && <p className="font-body text-xs font-light text-fg">({weekNumber} Pts)</p>}
    </div>
  )
}
