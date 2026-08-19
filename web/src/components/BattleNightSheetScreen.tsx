import type { BestOfNightState, BestOfSheetConfig, ChannelSnapshot } from '@total-tossup-live/shared'
import { containerWinner } from '@total-tossup-live/shared'
import { useUnitIconSize } from '../lib/useUnitIconSize'
import { ordinalWord } from '../lib/ordinal'
import { UnitColumns } from './UnitColumns'
import { CoinRow } from './CoinRow'
import { NightSheetFooter } from './NightSheetFooter'
import { SheetArea } from './SheetArea'
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
 * Layout: AppHeader (fixed, in App.tsx) + SheetArea (flexible, absorbs
 * whatever vertical space browser chrome actually leaves — see its own
 * doc comment) + CoinFrame + ScoreFrame, the latter two fixed heights
 * matching Josh's updated target spec (Figma node 254:1236) rather than
 * proportional shares of an assumed-full device height — that assumption
 * was what let real Safari chrome squeeze the old proportional split
 * shorter than Figma's own numbers expected. CoinFrame has no PhaseBanner
 * — Josh's own call, removed to give CoinRow the full region instead; the
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
      {/* SheetArea — flexible (see its own doc comment). 35/434 split for
       * the "NIGHT N" label over the unit grid (Josh's own Battle1Sheet-6
       * in Figma — same reservation on every Sheet, real pixel ratios
       * pulled straight from Figma). This ratio holds regardless of
       * SheetArea's own actual size, since flex-grow values are relative,
       * not anchored to a specific total. useUnitIconSize's ref sits on
       * the 434 sub-region, not the full box — so the icon-sizing math
       * already accounts for the label's own space, same as Josh's own
       * manual Battle1Sheet adjustment (Night One's 3-unit columns are
       * tall enough to need it), and needs zero special-casing for the
       * Sheets that already had room without adjusting anything (2-6:
       * more units means smaller icons already, so the reserved strip is
       * just headroom they weren't using anyway). min-h-0 everywhere:
       * flex items default to a content-based min-height, which would let
       * a tall region (e.g. Night Six's 13-unit grid) push past its
       * flex-[N] share instead of respecting the proportional split. */}
      <SheetArea>
        <div className="flex h-full w-full flex-col items-center">
          <div className="flex min-h-0 flex-[35] items-center justify-center">
            <p className="font-display text-2xl uppercase text-fg sm:text-3xl">Night {ordinalWord(snapshot.nightNumber)}</p>
          </div>
          <div ref={sheetFrameRef} className="flex min-h-0 w-full flex-[434] items-center justify-center gap-8 sm:gap-16">
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
        </div>
      </SheetArea>

      {/* CoinFrame — fixed height (Figma's updated target spec). PhaseBanner
       * keeps its own fixed height at the top; CoinRow gets the rest via
       * flex-1, so each of its 5 columns fills the full height actually
       * left over. */}
      <div className="flex h-[130px] shrink-0 flex-col items-center gap-1">
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

      {/* ScoreFrame — fixed height (unchanged from before, 152px).
       * TensionBar (38/152) forms its own top edge — no separate border-t
       * needed, it's a bolder divider from CoinFrame above than a plain
       * line was. Bordered bg-card box below it matches AppHeader's frame
       * treatment. */}
      <div className="flex h-[152px] shrink-0 flex-col bg-card">
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
