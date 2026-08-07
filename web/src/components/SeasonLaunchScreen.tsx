import type { ChannelSnapshot } from '@total-tossup-live/shared'
import { CountdownBar } from './CountdownBar'
import { MatchupHeader } from './MatchupHeader'
import { Wordmark } from './Wordmark'

interface SeasonLaunchScreenProps {
  snapshot: ChannelSnapshot
  progress: number
}

export function SeasonLaunchScreen({ snapshot, progress }: SeasonLaunchScreenProps) {
  return (
    <div className="flex w-full flex-col items-center gap-8 text-center">
      <Wordmark />

      <MatchupHeader
        lifetimeRecord={snapshot.lifetimeRecord}
        center={<p className="font-display text-3xl text-fg sm:text-4xl">VS.</p>}
      />

      <div className="flex flex-col items-center gap-2">
        <p className="font-body text-2xl font-bold uppercase text-fg">TTL Season {snapshot.seasonNumber}</p>
        <p className="font-body text-lg text-fg">Starts in</p>
        <div className="mt-2 w-64">
          <CountdownBar progress={progress} />
        </div>
      </div>
    </div>
  )
}
