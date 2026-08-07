import type { ChannelSnapshot } from '@total-tossup-live/shared'
import { CountdownBar } from './CountdownBar'

interface SeasonOverviewScreenProps {
  snapshot: ChannelSnapshot
  progress: number
}

export function SeasonOverviewScreen({ snapshot, progress }: SeasonOverviewScreenProps) {
  const weeks = Array.from({ length: snapshot.weeksPerSeason }, (_, i) => i + 1)
  const resultByWeek = new Map(snapshot.completedWeeks.map((w) => [w.weekNumber, w.winner]))

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <p className="text-xs uppercase tracking-widest text-neutral-600">Season {snapshot.seasonNumber}</p>
      <h2 className="text-3xl font-semibold tracking-tight text-neutral-100">
        Week {snapshot.weekNumber} of {snapshot.weeksPerSeason}
      </h2>

      <div className="flex flex-col gap-1.5">
        {weeks.map((weekNumber) => {
          const winner = resultByWeek.get(weekNumber)
          const isCurrent = weekNumber === snapshot.weekNumber
          return (
            <div
              key={weekNumber}
              className={`flex w-56 items-center justify-between rounded-md px-3 py-1.5 text-sm ${
                isCurrent ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-500'
              }`}
            >
              <span>Week {weekNumber}</span>
              <span className="font-medium">
                {winner === 'humans' && <span className="text-sky-400">Humans</span>}
                {winner === 'demons' && <span className="text-rose-400">Demons</span>}
                {!winner && (isCurrent ? 'starting now' : '—')}
              </span>
            </div>
          )
        })}
      </div>

      <p className="tabular-nums text-neutral-400">
        Season score: <span className="text-sky-400">{snapshot.seasonScore.humans}</span>
        {' – '}
        <span className="text-rose-400">{snapshot.seasonScore.demons}</span>
      </p>

      <div className="mt-2 w-64">
        <CountdownBar progress={progress} />
      </div>
    </div>
  )
}
