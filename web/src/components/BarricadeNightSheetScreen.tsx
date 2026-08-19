import type { ChannelSnapshot, TeamworkNightState, TeamworkSheetConfig } from '@total-tossup-live/shared'
import { ordinalWord } from '../lib/ordinal'
import { CoinRow } from './CoinRow'
import { NightSheetFooter } from './NightSheetFooter'
import { SymbolGrid } from './SymbolGrid'
import { BarricadeBars } from './BarricadeBars'
import { BARRICADE_ICON_SRC } from '../lib/barricadeSymbols'
import barricadeScene from '../assets/barricade/barricade-scene.png'

interface BarricadeNightSheetScreenProps {
  snapshot: ChannelSnapshot
}

/**
 * The 'barricade' Sheet style — Teamwork Family's first Sheet (see
 * worker/src/families/teamwork.ts for the real 4-flip-per-round win math).
 * A static Figma export stands in for the scene's real gameplay art until
 * the illustration itself needs to react to game state. Same 3-region
 * proportional layout as BattleNightSheetScreen (SheetFrame/CoinFrame/
 * ScoreFrame — 469/144/152 out of 765, Figma's own NightScreen_iPhone
 * split, shared by every Sheet style so a viewer's eye doesn't jump
 * switching Sheets) — but ScoreFrame reuses NightSheetFooter completely
 * as-is, since none of its fields are Family-specific.
 *
 * SheetFrame stacks the scene image, the live BarricadeBars overlay, and
 * SymbolGrid at the same real Figma proportions the original two static
 * exports used (311/477 scene, 166/477 board — node 83:129) with the
 * "Night N" label absolutely positioned over the scene, matching that
 * node's own position (left:101,top:11 of 409x477 → ~24.7%/2.3%) and
 * Battle's established label styling. BarricadeScene carries a border in
 * Figma; the border is drawn by this wrapper, not baked into the exported
 * PNG.
 *
 * CoinFrame now shows the Night's actual in-progress round (4 real flips,
 * not a static idle render) — Teamwork's round size is always 4 (see
 * teamwork.ts), matching CoinRow's own slots count here.
 *
 * SymbolGrid's arrangement comes straight off sheetConfig -- broadcast to
 * every viewer as part of ChannelSnapshot, so there's no separate
 * hardcoded copy of "which icon is on which cell" living in web/ anymore.
 * It's still a static reference grid, not yet highlighting which cell the
 * current/last round actually landed on -- that's a follow-up.
 */
export function BarricadeNightSheetScreen({ snapshot }: BarricadeNightSheetScreenProps) {
  const nightState = snapshot.nightState as TeamworkNightState
  const sheetConfig = snapshot.sheetConfig as TeamworkSheetConfig
  const phaseDurationMs = snapshot.phaseEndsAt - snapshot.phaseStartedAt

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex min-h-0 flex-[469] flex-col">
        <div className="relative flex min-h-0 flex-[311] items-center justify-center border-[3px] border-fg">
          <img src={barricadeScene} alt="" className="h-full w-full object-contain" />
          <BarricadeBars
            humanMarked={nightState.medkitCount}
            demonMarked={nightState.knifeCount}
            barricadeMarked={nightState.barricadeCount}
          />
          <p className="absolute left-[24.7%] top-[2.3%] font-display text-2xl uppercase text-fg sm:text-3xl">
            Night {ordinalWord(snapshot.nightNumber)}
          </p>
        </div>
        <div className="flex min-h-0 flex-[166] items-center justify-center">
          <SymbolGrid arrangement={sheetConfig.arrangement} iconSrc={BARRICADE_ICON_SRC} />
        </div>
      </div>

      {/* CoinFrame — 144/765, same region CoinRow fills on Battle Sheets. */}
      <div className="flex min-h-0 flex-[144] flex-col items-center gap-1">
        <div className="w-full min-h-0 flex-1">
          <CoinRow
            slots={4}
            flips={nightState.currentRound.flips}
            isFlipping={snapshot.phase === 'flipping'}
            phaseDurationMs={phaseDurationMs}
            flipKey={snapshot.pendingFlip?.sequenceIndex ?? -1}
          />
        </div>
      </div>

      {/* ScoreFrame — 152/765. No TensionBar (that's bestof round-win-
       * proximity specific); NightSheetFooter alone, centered, matches the
       * bordered bg-card frame treatment every other Sheet style uses. */}
      <div className="flex min-h-0 flex-[152] flex-col items-center justify-center gap-2 border-t-2 border-fg bg-card px-4">
        <NightSheetFooter snapshot={snapshot} />
      </div>
    </div>
  )
}
