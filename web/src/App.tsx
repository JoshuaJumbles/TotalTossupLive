import type { BestOfNightState, BestOfSheetConfig } from '@total-tossup-live/shared'
import { useChannelSnapshot } from './lib/useChannelSnapshot'
import { usePhaseProgress } from './lib/usePhaseProgress'
import { CoinFlip } from './components/CoinFlip'
import { ScoreBoard } from './components/ScoreBoard'
import { RoundTracker } from './components/RoundTracker'
import { PhaseBanner } from './components/PhaseBanner'

function App() {
  const { snapshot, connected } = useChannelSnapshot()
  const progress = usePhaseProgress(snapshot?.phaseStartedAt ?? 0, snapshot?.phaseEndsAt ?? 0)

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-neutral-950 p-6 text-neutral-100">
      <header className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Total Tossup Live</h1>
        <p className="text-xs text-neutral-500">{connected ? 'live' : 'reconnecting…'}</p>
      </header>

      {!snapshot ? (
        <p className="text-neutral-400">{connected ? 'loading…' : 'connecting…'}</p>
      ) : (
        <ChannelView snapshot={snapshot} progress={progress} />
      )}
    </div>
  )
}

// Only the 'bestof' Family exists so far — this is the one place that
// narrows the generic NightState/SheetConfig union down to it. A second
// Family arriving means branching here, not touching the hooks above.
function ChannelView({
  snapshot,
  progress,
}: {
  snapshot: NonNullable<ReturnType<typeof useChannelSnapshot>['snapshot']>
  progress: number
}) {
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

export default App
