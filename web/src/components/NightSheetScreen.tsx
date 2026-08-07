import type { BestOfNightState, BestOfSheetConfig, ChannelSnapshot, Side } from '@total-tossup-live/shared'
import { containerWinner } from '@total-tossup-live/shared'
import { CoinFlip } from './CoinFlip'
import { RoundTracker } from './RoundTracker'
import { PhaseBanner } from './PhaseBanner'

interface NightSheetScreenProps {
  snapshot: ChannelSnapshot
  progress: number
}

// Only the 'bestof' Family exists so far — this is the one place that
// narrows the generic NightState/SheetConfig union down to it. A second
// Family arriving means branching here, not touching the screen dispatch.
//
// Deliberately leaner than the other three screens, matching the Figma
// source: no Wordmark, no portraits/crown, no lifetime record — this
// screen is about winning the current Night/Week, history stays
// downplayed here on purpose.
export function NightSheetScreen({ snapshot, progress }: NightSheetScreenProps) {
  if (snapshot.familyId !== 'bestof') {
    return <p className="font-body text-fg">Unknown Family: {snapshot.familyId}</p>
  }

  const nightState = snapshot.nightState as BestOfNightState
  const sheetConfig = snapshot.sheetConfig as BestOfSheetConfig
  const lastFlip = nightState.currentRound.flips.at(-1) ?? null
  const champion = containerWinner(snapshot.lifetimeRecord)

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <p className="font-display text-3xl uppercase text-fg sm:text-4xl">Night {snapshot.nightNumber}</p>

      <PhaseBanner phase={snapshot.phase} progress={progress} />

      <CoinFlip
        phase={snapshot.phase}
        phaseDurationMs={snapshot.phaseEndsAt - snapshot.phaseStartedAt}
        flipKey={snapshot.pendingFlip?.sequenceIndex ?? -1}
        lastFlip={lastFlip}
      />

      <RoundTracker nightState={nightState} sheetConfig={sheetConfig} />

      <div className="flex w-full items-center justify-center gap-6 sm:gap-10">
        <TeamCaption side="humans" isChampion={champion === 'humans'} seasonPts={snapshot.seasonScore.humans} />
        <div className="flex flex-col items-center gap-1">
          <p className="font-display text-5xl text-fg sm:text-6xl">
            {snapshot.weekScore.humans} : {snapshot.weekScore.demons}
          </p>
          <p className="font-body text-lg text-fg">Week {snapshot.weekNumber}</p>
        </div>
        <TeamCaption side="demons" isChampion={champion === 'demons'} seasonPts={snapshot.seasonScore.demons} />
      </div>
    </div>
  )
}

function TeamCaption({ side, isChampion, seasonPts }: { side: Side; isChampion: boolean; seasonPts: number }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <p className="font-display text-xl uppercase text-fg sm:text-2xl">{side}</p>
      <p className="font-body text-sm text-fg">{isChampion ? 'Champion' : 'Challenger'}</p>
      <p className="font-body text-xs font-light text-fg">{seasonPts} Season Pts</p>
    </div>
  )
}
