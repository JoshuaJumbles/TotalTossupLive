import type { ChannelSnapshot, Side } from '@total-tossup-live/shared'
import { containerWinner } from '@total-tossup-live/shared'
import { CountdownBar } from './CountdownBar'
import { MatchupHeader } from './MatchupHeader'
import { TeamPortrait } from './TeamPortrait'
import { Wordmark } from './Wordmark'

const SIDE_LABEL: Record<Side, string> = { humans: 'Humans', demons: 'Demons' }

interface SeasonFinishScreenProps {
  snapshot: ChannelSnapshot
  progress: number
}

export function SeasonFinishScreen({ snapshot, progress }: SeasonFinishScreenProps) {
  // season_won only fires once the Season's score is fully decided, and the
  // triangular-pool math guarantees no tie is possible — see scoring.ts.
  const seasonWinner = containerWinner(snapshot.seasonScore)!
  const isNowChampion = containerWinner(snapshot.lifetimeRecord) === seasonWinner
  const subtext = isNowChampion ? 'and extends the championship lead' : 'and gets closer to taking the champion title'

  return (
    <div className="flex w-full flex-col items-center gap-6 text-center">
      <Wordmark />

      <TeamPortrait side={seasonWinner} isChampion={isNowChampion} className="w-48 sm:w-56" />

      <MatchupHeader
        lifetimeRecord={snapshot.lifetimeRecord}
        showPortraits={false}
        center={
          <div className="flex flex-col items-center gap-1">
            <p className="font-body text-sm font-light uppercase text-fg">Final Season Score</p>
            <p className="font-display text-6xl text-fg sm:text-7xl">
              {snapshot.seasonScore.humans} : {snapshot.seasonScore.demons}
            </p>
          </div>
        }
      />

      <div className="flex flex-col items-center gap-1">
        <p className="font-body text-3xl font-bold uppercase text-fg sm:text-4xl">
          {SIDE_LABEL[seasonWinner]} Win
          <br />
          TTL Season {snapshot.seasonNumber}
        </p>
        <p className="font-body text-lg text-fg">{subtext}</p>
      </div>

      <div className="w-64">
        <CountdownBar progress={progress} />
      </div>
    </div>
  )
}
