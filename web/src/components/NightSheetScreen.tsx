import type { BestOfNightState, BestOfSheetConfig, ChannelSnapshot } from '@total-tossup-live/shared'
import { CoinFlip } from './CoinFlip'
import { RoundTracker } from './RoundTracker'
import { PhaseBanner } from './PhaseBanner'
import { NightSheetFooter } from './NightSheetFooter'
import { BattleNightSheetScreen } from './BattleNightSheetScreen'

interface NightSheetScreenProps {
  snapshot: ChannelSnapshot
  progress: number
}

// Only the 'bestof' Family exists so far — this is the one place that
// narrows the generic NightState/SheetConfig union down to it. A second
// Family arriving means branching here, not touching the screen dispatch.
//
// Dispatches further on sheetStyle: 'battle' Sheets get the unit-grid +
// coin-row visual (BattleNightSheetScreen); everything else falls through
// to this plain numeric view.
export function NightSheetScreen({ snapshot, progress }: NightSheetScreenProps) {
  if (snapshot.familyId !== 'bestof') {
    return <p className="px-6 pb-6 font-body text-fg">Unknown Family: {snapshot.familyId}</p>
  }

  // Battle renders full-bleed (Figma's NightScreen_iPhone) — no px-6 pb-6,
  // unlike every other screen below, which wants that breathing room.
  if (snapshot.sheetStyle === 'battle') {
    return <BattleNightSheetScreen snapshot={snapshot} />
  }

  const nightState = snapshot.nightState as BestOfNightState
  const sheetConfig = snapshot.sheetConfig as BestOfSheetConfig
  const lastFlip = nightState.currentRound.flips.at(-1) ?? null

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 px-6 pb-6">
      <p className="font-display text-3xl uppercase text-fg sm:text-4xl">Night {snapshot.nightNumber}</p>

      <PhaseBanner phase={snapshot.phase} progress={progress} />

      <CoinFlip
        phase={snapshot.phase}
        phaseDurationMs={snapshot.phaseEndsAt - snapshot.phaseStartedAt}
        flipKey={snapshot.pendingFlip?.sequenceIndex ?? -1}
        lastFlip={lastFlip}
      />

      <RoundTracker nightState={nightState} sheetConfig={sheetConfig} />

      <NightSheetFooter snapshot={snapshot} />
    </div>
  )
}
