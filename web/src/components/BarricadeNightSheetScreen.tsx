import type { ChannelSnapshot } from '@total-tossup-live/shared'
import { ordinalWord } from '../lib/ordinal'
import { CoinRow } from './CoinRow'
import { NightSheetFooter } from './NightSheetFooter'
import { SymbolGrid } from './SymbolGrid'
import barricadeScene from '../assets/barricade/barricade-scene.png'

interface BarricadeNightSheetScreenProps {
  snapshot: ChannelSnapshot
}

/**
 * The 'barricade' Sheet style — Teamwork Family's first Sheet, first-pass
 * stub (see worker/src/families/teamwork.ts): a static Figma export stands
 * in for the scene's real gameplay art until the tracker board's own
 * mechanic (knife/kit/board resources) is designed. Same 3-region
 * proportional layout as BattleNightSheetScreen (SheetFrame/CoinFrame/
 * ScoreFrame — 469/144/152 out of 765, Figma's own NightScreen_iPhone
 * split, shared by every Sheet style so a viewer's eye doesn't jump
 * switching Sheets) — but CoinFrame and ScoreFrame reuse their generic
 * components completely as-is: a static idle CoinRow (4 slots, no flips —
 * Barricade's own coin count per Josh's plan) and NightSheetFooter
 * unchanged, since none of its fields are Family-specific.
 *
 * SheetFrame stacks the scene image and SymbolGrid at the same real Figma
 * proportions the original two static exports used (311/477 scene,
 * 166/477 board — node 83:129) with the "Night N" label absolutely
 * positioned over the scene, matching that node's own position
 * (left:101,top:11 of 409x477 → ~24.7%/2.3%) and Battle's established
 * label styling. BarricadeScene carries a border in Figma; the border is
 * drawn by this wrapper, not baked into the exported PNG.
 *
 * The board region below the scene used to be its own static export too —
 * now a live SymbolGrid (see that component's own doc comment for why:
 * Josh's own coin-grid mechanic needs to render 8 real, eventually
 * per-Night-configurable pairs, not a flat picture).
 */
export function BarricadeNightSheetScreen({ snapshot }: BarricadeNightSheetScreenProps) {
  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex min-h-0 flex-[469] flex-col">
        <div className="relative flex min-h-0 flex-[311] items-center justify-center border-[3px] border-fg">
          <img src={barricadeScene} alt="" className="h-full w-full object-contain" />
          <p className="absolute left-[24.7%] top-[2.3%] font-display text-2xl uppercase text-fg sm:text-3xl">
            Night {ordinalWord(snapshot.nightNumber)}
          </p>
        </div>
        <div className="flex min-h-0 flex-[166] items-center justify-center">
          <SymbolGrid />
        </div>
      </div>

      {/* CoinFrame — 144/765, same region CoinRow fills on Battle Sheets.
       * Static idle render: 4 coin slots, none flipped — Barricade's own
       * coin count per Josh's plan, no autoplay-driven flip state to feed
       * it yet since the engine resolves a Night on its very first flip. */}
      <div className="flex min-h-0 flex-[144] flex-col items-center gap-1">
        <div className="w-full min-h-0 flex-1">
          <CoinRow slots={4} flips={[]} isFlipping={false} phaseDurationMs={0} flipKey={-1} />
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
