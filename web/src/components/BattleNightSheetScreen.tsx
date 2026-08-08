import type { BestOfNightState, BestOfSheetConfig, ChannelSnapshot } from '@total-tossup-live/shared'
import { PhaseBanner } from './PhaseBanner'
import { UnitRow } from './UnitRow'
import { CoinRow } from './CoinRow'
import { NightSheetFooter } from './NightSheetFooter'

interface BattleNightSheetScreenProps {
  snapshot: ChannelSnapshot
  progress: number
}

/**
 * The 'battle' Sheet style: a visual reskin of the exact same bestof
 * mechanics as the plain Night Sheet — no new engine, no new resolution
 * logic. Two things replace the plain numeric text: a unit grid per side
 * (N = targetRoundPoints, crossed off as rounds are won — in the *winning*
 * side's color, marked onto the *losing* side's grid) and a left-to-right
 * coin row showing the current round's flip history instead of a "2-1"
 * count. Both are pure derivations of data the engine already produces
 * (roundPoints, currentRound.flips) plus the server-generated, persisted
 * unitCrossOrder that decides *which* unit gets crossed each time.
 */
export function BattleNightSheetScreen({ snapshot, progress }: BattleNightSheetScreenProps) {
  const nightState = snapshot.nightState as BestOfNightState
  const sheetConfig = snapshot.sheetConfig as BestOfSheetConfig
  const target = sheetConfig.targetRoundPoints

  // Demons winning K rounds crosses off the first K entries of the humans'
  // pre-shuffled order (and vice versa) — see unitCrossOrder's doc comment
  // in shared/src/snapshot.ts for why this needs no per-round randomness.
  const crossedHumans = new Set(snapshot.unitCrossOrder.humans.slice(0, nightState.roundPoints.demons))
  const crossedDemons = new Set(snapshot.unitCrossOrder.demons.slice(0, nightState.roundPoints.humans))

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <p className="font-display text-3xl uppercase text-fg sm:text-4xl">Night {snapshot.nightNumber}</p>

      <PhaseBanner phase={snapshot.phase} progress={progress} />

      <div className="flex w-full items-start justify-center gap-8 sm:gap-16">
        <UnitRow side="humans" total={target} crossedIndices={crossedHumans} markColorClass="text-demons" />
        <UnitRow side="demons" total={target} crossedIndices={crossedDemons} markColorClass="text-humans" />
      </div>

      <CoinRow
        slots={sheetConfig.roundSize}
        flips={nightState.currentRound.flips}
        isFlipping={snapshot.phase === 'flipping'}
        phaseDurationMs={snapshot.phaseEndsAt - snapshot.phaseStartedAt}
        flipKey={snapshot.pendingFlip?.sequenceIndex ?? -1}
      />

      <NightSheetFooter snapshot={snapshot} />
    </div>
  )
}
