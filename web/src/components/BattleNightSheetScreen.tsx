import type { BestOfNightState, BestOfSheetConfig, ChannelSnapshot } from '@total-tossup-live/shared'
import { useUnitIconSize } from '../lib/useUnitIconSize'
import { PhaseBanner } from './PhaseBanner'
import { UnitColumns } from './UnitColumns'
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
 *
 * Layout is 3 stacked regions filling the full height AppHeader leaves
 * available (TitleFrame itself is now the universal header, rendered once
 * in App.tsx) — matching Figma's NightScreen_iPhone frame: SheetFrame,
 * CoinFrame, ScoreFrame. Each region's flex-[N] is that frame's own pixel
 * height from Figma (469/144/152 out of the 765px below TitleFrame) — a
 * true proportional split (flex-basis 0), not fixed pixels, so it holds
 * the same shape at any viewport height. PhaseBanner (not one of Figma's
 * four named frames) tucks into the top of CoinFrame per Josh's call —
 * the coin row shifts down to make room, keeping the round result
 * announced right where the eye already is, next to the coin that just
 * landed.
 */
export function BattleNightSheetScreen({ snapshot, progress }: BattleNightSheetScreenProps) {
  const nightState = snapshot.nightState as BestOfNightState
  const sheetConfig = snapshot.sheetConfig as BestOfSheetConfig
  const target = sheetConfig.targetRoundPoints
  const { ref: sheetFrameRef, size: unitSize } = useUnitIconSize(target)

  // Demons winning K rounds crosses off the first K entries of the humans'
  // pre-shuffled order (and vice versa) — see unitCrossOrder's doc comment
  // in shared/src/snapshot.ts for why this needs no per-round randomness.
  const crossedHumans = new Set(snapshot.unitCrossOrder.humans.slice(0, nightState.roundPoints.demons))
  const crossedDemons = new Set(snapshot.unitCrossOrder.demons.slice(0, nightState.roundPoints.humans))

  return (
    <div className="flex h-full w-full flex-col">
      {/* SheetFrame — 469/765. min-h-0 on every region: flex items default
       * to a content-based min-height, which would let a tall region
       * (e.g. Night Six's 13-unit grid) push past its flex-[N] share
       * instead of respecting the proportional split. Also the measured
       * element for useUnitIconSize — see UnitColumns for the column
       * layout this size drives. */}
      <div ref={sheetFrameRef} className="flex min-h-0 flex-[469] items-center justify-center gap-8 sm:gap-16">
        <UnitColumns side="humans" total={target} size={unitSize} crossedIndices={crossedHumans} markColorClass="text-demons" />
        <UnitColumns side="demons" total={target} size={unitSize} crossedIndices={crossedDemons} markColorClass="text-humans" />
      </div>

      {/* CoinFrame — 144/765. PhaseBanner keeps its own fixed height at the
       * top; CoinRow gets the rest via flex-1, so each of its 5 columns
       * fills the full height actually left over — not the full 144/765
       * share, which Josh's CoinDisplaySet reference assumes before
       * accounting for PhaseBanner's space. */}
      <div className="flex min-h-0 flex-[144] flex-col items-center gap-1">
        <PhaseBanner phase={snapshot.phase} progress={progress} />
        <div className="w-full min-h-0 flex-1">
          <CoinRow
            slots={sheetConfig.roundSize}
            flips={nightState.currentRound.flips}
            isFlipping={snapshot.phase === 'flipping'}
            phaseDurationMs={snapshot.phaseEndsAt - snapshot.phaseStartedAt}
            flipKey={snapshot.pendingFlip?.sequenceIndex ?? -1}
          />
        </div>
      </div>

      {/* ScoreFrame — 152/765. Bordered bg-card box matches AppHeader's
       * frame treatment; the score/streak/week-bar content inside it is
       * still Josh's WIP territory, left as NightSheetFooter for now. */}
      <div className="flex min-h-0 flex-[152] flex-col items-center justify-center gap-2 border-t-4 border-fg bg-card px-4">
        <p className="font-display text-xl uppercase text-fg">Night {snapshot.nightNumber}</p>
        <NightSheetFooter snapshot={snapshot} />
      </div>
    </div>
  )
}
