import type { BestOfNightState, BestOfSheetConfig, ChannelSnapshot } from '@total-tossup-live/shared'
import { CoinFlip } from './CoinFlip'
import { RoundTracker } from './RoundTracker'
import { PhaseBanner } from './PhaseBanner'
import { NightSheetFooter } from './NightSheetFooter'
import { BattleNightSheetScreen } from './BattleNightSheetScreen'
import { BarricadeNightSheetScreen } from './BarricadeNightSheetScreen'

interface NightSheetScreenProps {
  snapshot: ChannelSnapshot
  progress: number
}

// Dispatches on sheetStyle FIRST, before narrowing by familyId — each
// visually-distinct style (battle, barricade) owns its own screen and
// reads whatever NightState/SheetConfig shape its own Family produces, so
// those checks have to come before any single-Family guard below them.
// Only once neither of those styles matches do we fall through to the
// plain numeric view, which today is 'bestof'-only — a second Family
// landing here (rather than getting its own style) means widening this
// guard, not touching the dispatch order above it.
export function NightSheetScreen({ snapshot, progress }: NightSheetScreenProps) {
  // Battle renders full-bleed (Figma's NightScreen_iPhone) — no px-6 pb-6,
  // unlike every other screen below, which wants that breathing room.
  if (snapshot.sheetStyle === 'battle') {
    return <BattleNightSheetScreen snapshot={snapshot} />
  }

  if (snapshot.sheetStyle === 'barricade') {
    return <BarricadeNightSheetScreen snapshot={snapshot} />
  }

  if (snapshot.familyId !== 'bestof') {
    return <p className="px-6 pb-6 font-body text-fg">Unknown Family: {snapshot.familyId}</p>
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
