import type { ChannelSnapshot } from '@total-tossup-live/shared'
import { CountdownBar } from './CountdownBar'

interface SeasonLaunchScreenProps {
  snapshot: ChannelSnapshot
  progress: number
}

export function SeasonLaunchScreen({ snapshot, progress }: SeasonLaunchScreenProps) {
  const { humans, demons } = snapshot.lifetimeRecord
  // Unlike Night/Week/Season scoring, lifetimeRecord has no tie-proof
  // guarantee — it's a plain counter across independent seasons, so a tie
  // (or a fresh 0-0 history) is a normal, expected state here.
  const leadText =
    humans === 0 && demons === 0
      ? 'No history yet'
      : humans === demons
        ? 'All square'
        : humans > demons
          ? `Humans lead the series ${humans}–${demons}`
          : `Demons lead the series ${demons}–${humans}`

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <p className="text-xs uppercase tracking-widest text-neutral-600">Lifetime seasons won</p>

      <div className="flex items-baseline gap-4 text-5xl font-bold tabular-nums">
        <span className="text-sky-400">{humans}</span>
        <span className="text-neutral-700">–</span>
        <span className="text-rose-400">{demons}</span>
      </div>

      <p className="text-neutral-400">{leadText}</p>

      <h2 className="mt-4 text-3xl font-semibold tracking-tight text-neutral-100">
        Season {snapshot.seasonNumber} begins
      </h2>

      <div className="mt-2 w-64">
        <CountdownBar progress={progress} />
      </div>
    </div>
  )
}
