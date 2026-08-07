import type { ChannelSnapshot } from '@total-tossup-live/shared'
import { CountdownBar } from './CountdownBar'

interface SeasonFinishScreenProps {
  snapshot: ChannelSnapshot
  progress: number
}

export function SeasonFinishScreen({ snapshot, progress }: SeasonFinishScreenProps) {
  const { humans, demons } = snapshot.seasonScore
  // season_won only fires once the Season's container score is fully
  // decided, and the triangular-pool math guarantees no tie is possible —
  // see shared/src/scoring.ts.
  const winner = humans > demons ? 'Humans' : 'Demons'

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <p className="text-xs uppercase tracking-widest text-neutral-600">Season {snapshot.seasonNumber} complete</p>
      <h2 className="text-4xl font-bold tracking-tight text-neutral-100">{winner} win the season!</h2>

      <p className="text-lg tabular-nums text-neutral-300">
        <span className="text-sky-400">{humans}</span>
        {' – '}
        <span className="text-rose-400">{demons}</span>
      </p>

      <div className="mt-4 flex flex-col items-center gap-1">
        <p className="text-xs uppercase tracking-widest text-neutral-600">Lifetime seasons won</p>
        <p className="text-2xl font-semibold tabular-nums">
          <span className="text-sky-400">{snapshot.lifetimeRecord.humans}</span>
          {' – '}
          <span className="text-rose-400">{snapshot.lifetimeRecord.demons}</span>
        </p>
      </div>

      <div className="mt-4 w-64">
        <CountdownBar progress={progress} />
      </div>
    </div>
  )
}
