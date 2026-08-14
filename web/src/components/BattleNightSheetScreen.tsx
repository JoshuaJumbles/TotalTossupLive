import type { BestOfNightState, BestOfSheetConfig, ChannelSnapshot } from '@total-tossup-live/shared'
import { containerWinner } from '@total-tossup-live/shared'
import { useUnitIconSize } from '../lib/useUnitIconSize'
import { UnitColumns } from './UnitColumns'
import { CoinRow } from './CoinRow'
import { NightSheetFooter } from './NightSheetFooter'
import { TensionBar } from './TensionBar'

interface BattleNightSheetScreenProps {
  snapshot: ChannelSnapshot
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
 * the same shape at any viewport height. CoinFrame has no PhaseBanner —
 * Josh's own call, removed to give CoinRow the full region instead; the
 * per-flip result animation (CoinFlipHand → CoinResult) now carries that
 * announcement on its own.
 */
export function BattleNightSheetScreen({ snapshot }: BattleNightSheetScreenProps) {
  const nightState = snapshot.nightState as BestOfNightState
  const sheetConfig = snapshot.sheetConfig as BestOfSheetConfig
  const target = sheetConfig.targetRoundPoints
  const { ref: sheetFrameRef, size: unitSize } = useUnitIconSize(target)

  // Demons winning K rounds crosses off the first K entries of the humans'
  // pre-shuffled order (and vice versa) — see unitCrossOrder's doc comment
  // in shared/src/snapshot.ts for why this needs no per-round randomness.
  const crossedHumans = new Set(snapshot.unitCrossOrder.humans.slice(0, nightState.roundPoints.demons))
  const crossedDemons = new Set(snapshot.unitCrossOrder.demons.slice(0, nightState.roundPoints.humans))

  // Which unit (if any) just got crossed off THIS round_resolved pause, for
  // CrossOutMark. currentRound is kept (not reset) through this pause
  // specifically so its flipWins still reflects the round that just closed
  // (see bestof.ts) — containerWinner on it is that round's winner, whose
  // roundPoints was just incremented by exactly 1, so the newest entry in
  // the loser's unitCrossOrder slice is the unit that just got marked.
  const roundWinner = snapshot.phase === 'round_resolved' ? containerWinner(nightState.currentRound.flipWins) : null
  const loserSide = roundWinner === 'humans' ? 'demons' : roundWinner === 'demons' ? 'humans' : null
  const justCrossedIndex = loserSide ? snapshot.unitCrossOrder[loserSide][nightState.roundPoints[roundWinner!] - 1] : null
  const phaseDurationMs = snapshot.phaseEndsAt - snapshot.phaseStartedAt

  return (
    <div className="flex h-full w-full flex-col">
      {/* SheetFrame — 469/765. min-h-0 on every region: flex items default
       * to a content-based min-height, which would let a tall region
       * (e.g. Night Six's 13-unit grid) push past its flex-[N] share
       * instead of respecting the proportional split. Also the measured
       * element for useUnitIconSize — see UnitColumns for the column
       * layout this size drives. */}
      <div ref={sheetFrameRef} className="flex min-h-0 flex-[469] items-center justify-center gap-8 sm:gap-16">
        <UnitColumns
          side="humans"
          total={target}
          size={unitSize}
          crossedIndices={crossedHumans}
          markColorClass="text-demons"
          justCrossedIndex={loserSide === 'humans' ? justCrossedIndex : null}
          phaseDurationMs={phaseDurationMs}
        />
        <UnitColumns
          side="demons"
          total={target}
          size={unitSize}
          crossedIndices={crossedDemons}
          markColorClass="text-humans"
          justCrossedIndex={loserSide === 'demons' ? justCrossedIndex : null}
          phaseDurationMs={phaseDurationMs}
        />
      </div>

      {/* CoinFrame — 144/765. PhaseBanner keeps its own fixed height at the
       * top; CoinRow gets the rest via flex-1, so each of its 5 columns
       * fills the full height actually left over — not the full 144/765
       * share, which Josh's CoinDisplaySet reference assumes before
       * accounting for PhaseBanner's space. */}
      <div className="flex min-h-0 flex-[144] flex-col items-center gap-1">
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

      {/* ScoreFrame — 152/765. TensionBar (38/152) forms its own top edge
       * — no separate border-t needed, it's a bolder divider from CoinFrame
       * above than a plain line was. Bordered bg-card box below it matches
       * AppHeader's frame treatment. */}
      <div className="flex min-h-0 flex-[152] flex-col bg-card">
        <div className="min-h-0 flex-[38]">
          <TensionBar flipWins={nightState.currentRound.flipWins} roundWinThreshold={sheetConfig.roundWinThreshold} />
        </div>
        <div className="flex min-h-0 flex-[114] flex-col items-center justify-center gap-2 px-4">
          <NightSheetFooter snapshot={snapshot} />
        </div>
      </div>
    </div>
  )
}
