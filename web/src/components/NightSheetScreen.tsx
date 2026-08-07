import type { BestOfNightState, BestOfSheetConfig, ChannelSnapshot } from '@total-tossup-live/shared'
import { CoinFlip } from './CoinFlip'
import { ScoreBoard } from './ScoreBoard'
import { RoundTracker } from './RoundTracker'
import { PhaseBanner } from './PhaseBanner'

interface NightSheetScreenProps {
  snapshot: ChannelSnapshot
  progress: number
}

// Only the 'bestof' Family exists so far — this is the one place that
// narrows the generic NightState/SheetConfig union down to it. A second
// Family arriving means branching here, not touching the screen dispatch.
export function NightSheetScreen({ snapshot, progress }: NightSheetScreenProps) {
  if (snapshot.familyId !== 'bestof') {
    return <p className="text-neutral-400">Unknown Family: {snapshot.familyId}</p>
  }

  const nightState = snapshot.nightState as BestOfNightState
  const sheetConfig = snapshot.sheetConfig as BestOfSheetConfig
  const lastFlip = nightState.currentRound.flips.at(-1) ?? null

  return (
    <>
      <PhaseBanner phase={snapshot.phase} progress={progress} />

      <CoinFlip
        phase={snapshot.phase}
        phaseDurationMs={snapshot.phaseEndsAt - snapshot.phaseStartedAt}
        flipKey={snapshot.pendingFlip?.sequenceIndex ?? -1}
        lastFlip={lastFlip}
      />

      <RoundTracker nightState={nightState} sheetConfig={sheetConfig} />

      <p className="text-xs uppercase tracking-widest text-neutral-600">
        Season {snapshot.seasonNumber} · Week {snapshot.weekNumber} · Night {snapshot.nightNumber}
      </p>

      <ScoreBoard snapshot={snapshot} />
    </>
  )
}
