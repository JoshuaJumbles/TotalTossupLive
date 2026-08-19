import type { BarricadeIcon, ChannelSnapshot, TeamworkNightState, TeamworkSheetConfig } from '@total-tossup-live/shared'
import { ordinalWord } from '../lib/ordinal'
import { useFitSheetWidth } from '../lib/useFitSheetWidth'
import { CoinRow } from './CoinRow'
import { NightSheetFooter } from './NightSheetFooter'
import { SheetArea } from './SheetArea'
import { SymbolGrid } from './SymbolGrid'
import { BarricadeBars } from './BarricadeBars'
import { BARRICADE_ICON_SRC } from '../lib/barricadeSymbols'
import barricadeScene from '../assets/barricade/barricade-scene.png'

interface BarricadeNightSheetScreenProps {
  snapshot: ChannelSnapshot
}

// The scene+grid stack's own real proportions (Figma's 409-wide
// BarricadeScene + BarricadeBoard region) -- see useFitSheetWidth's own
// doc comment for why locking the rendered box to this exact ratio is
// what keeps BarricadeBars' percentage-positioned marks correct with no
// further math, and CoinFrame/ScoreFrame's fixed heights below for why
// SheetArea is the one region that needs to flex at all.
const SHEET_WIDTH_REF = 409
const SCENE_HEIGHT_REF = 311
const GRID_HEIGHT_REF = 166
const SHEET_ASPECT = SHEET_WIDTH_REF / (SCENE_HEIGHT_REF + GRID_HEIGHT_REF)

/**
 * The 'barricade' Sheet style — Teamwork Family's first Sheet (see
 * worker/src/families/teamwork.ts for the real 4-flip-per-round win math).
 * A static Figma export stands in for the scene's real gameplay art until
 * the illustration itself needs to react to game state.
 *
 * Layout: AppHeader (fixed, in App.tsx) + SheetArea (flexible — see its
 * own doc comment) + CoinFrame + ScoreFrame, the latter two now fixed
 * heights matching Josh's own updated target spec (Figma node 254:1236)
 * rather than proportional shares of an assumed-full device height.
 *
 * Inside SheetArea, useFitSheetWidth locks the scene+grid stack to the
 * largest size that fits while holding its own real 409:477 aspect ratio
 * — so BarricadeBars' percentage-positioned marks and the "Night N"
 * label (font-size scaled to the fitted width) both resolve correctly at
 * any viewport size, with no further per-viewport math.
 */
export function BarricadeNightSheetScreen({ snapshot }: BarricadeNightSheetScreenProps) {
  const nightState = snapshot.nightState as TeamworkNightState<BarricadeIcon>
  const sheetConfig = snapshot.sheetConfig as TeamworkSheetConfig<BarricadeIcon>
  const phaseDurationMs = snapshot.phaseEndsAt - snapshot.phaseStartedAt
  const revealedFaces = nightState.currentRound.flips.map((flip) => flip.face)

  const { ref: sheetAreaRef, width } = useFitSheetWidth(SHEET_ASPECT)
  const sceneHeight = (width * SCENE_HEIGHT_REF) / SHEET_WIDTH_REF
  const gridHeight = (width * GRID_HEIGHT_REF) / SHEET_WIDTH_REF
  const labelFontSize = (width * 24) / SHEET_WIDTH_REF

  return (
    <div className="flex h-full w-full flex-col">
      <SheetArea>
        <div ref={sheetAreaRef} className="flex h-full w-full items-center justify-center">
          {width > 0 && (
            <div className="flex flex-col" style={{ width }}>
              <div className="relative border-[3px] border-fg" style={{ height: sceneHeight }}>
                <img src={barricadeScene} alt="" className="h-full w-full object-cover" />
                <BarricadeBars
                  humanMarked={nightState.defenderAction.length}
                  demonMarked={nightState.attackerAction.length}
                  barricadeMarked={nightState.defenderDefense.length}
                />
                <p
                  className="absolute left-[24.7%] top-[2.3%] font-display uppercase leading-none text-fg"
                  style={{ fontSize: labelFontSize }}
                >
                  Night {ordinalWord(snapshot.nightNumber)}
                </p>
              </div>
              <div style={{ height: gridHeight }}>
                <SymbolGrid arrangement={sheetConfig.arrangement} iconSrc={BARRICADE_ICON_SRC} revealedFaces={revealedFaces} />
              </div>
            </div>
          )}
        </div>
      </SheetArea>

      {/* CoinFrame — fixed height (Figma's updated target spec). */}
      <div className="flex h-[130px] shrink-0 flex-col items-center gap-1">
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

      {/* ScoreFrame — fixed height (unchanged from before, 152px). No
       * TensionBar (that's bestof round-win-proximity specific);
       * NightSheetFooter alone, centered. */}
      <div className="flex h-[152px] shrink-0 flex-col items-center justify-center gap-2 border-t-2 border-fg bg-card px-4">
        <NightSheetFooter snapshot={snapshot} />
      </div>
    </div>
  )
}
