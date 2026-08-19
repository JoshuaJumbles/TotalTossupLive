import type { ChannelSnapshot, CloudFightIcon, TeamworkNightState, TeamworkSheetConfig } from '@total-tossup-live/shared'
import { ordinalWord } from '../lib/ordinal'
import { useFitSheetWidth } from '../lib/useFitSheetWidth'
import { CoinRow } from './CoinRow'
import { NightSheetFooter } from './NightSheetFooter'
import { SheetArea } from './SheetArea'
import { SymbolGrid } from './SymbolGrid'
import { CloudFightBars } from './CloudFightBars'
import { CLOUDFIGHT_ICON_SRC } from '../lib/cloudFightSymbols'
import cloudFightScene from '../assets/cloudfight/cloudfight-scene.png'

interface CloudFightNightSheetScreenProps {
  snapshot: ChannelSnapshot
}

// Same 409-wide reference convention as BarricadeNightSheetScreen --
// CloudFight's own Figma scene frame (node 260:1282) is also 409x311, and
// there's no separate "board" image the way Barricade originally had, so
// GRID_HEIGHT_REF just reuses Barricade's own proportion for now rather
// than inventing a new one -- see useFitSheetWidth's own doc comment for
// why locking the rendered box to this exact ratio matters.
const SHEET_WIDTH_REF = 409
const SCENE_HEIGHT_REF = 311
const GRID_HEIGHT_REF = 166
const SHEET_ASPECT = SHEET_WIDTH_REF / (SCENE_HEIGHT_REF + GRID_HEIGHT_REF)

/**
 * The 'cloudfight' Sheet style — Teamwork Family's second Sheet (see
 * worker/src/families/teamwork.ts for the shared win math, and
 * cloudFightData.ts for this Sheet's own arrangement/targets). Humans
 * fighting demons from the clouds: jetpack + bow share one action score
 * across two visual lanes (the "handoff" mechanic -- SymbolGrid and the
 * bars both already read that straight off the engine's own ordered
 * per-track arrays, no CloudFight-specific code needed for either).
 *
 * The scene's own track art (numbers, chevrons) is still baked into the
 * static Figma export -- CloudFightBars overlays live marks on top of it,
 * same approach Barricade's own bars use. The Night N label's exact
 * position is a placeholder pending visual feedback, same as Barricade's
 * own first pass was.
 *
 * Layout otherwise identical to BarricadeNightSheetScreen: AppHeader
 * (fixed, in App.tsx) + SheetArea (flexible) + CoinFrame + ScoreFrame,
 * with useFitSheetWidth locking the scene+grid stack to its own real
 * aspect ratio so SymbolGrid and the label both resolve correctly at any
 * viewport size.
 */
export function CloudFightNightSheetScreen({ snapshot }: CloudFightNightSheetScreenProps) {
  const nightState = snapshot.nightState as TeamworkNightState<CloudFightIcon>
  const sheetConfig = snapshot.sheetConfig as TeamworkSheetConfig<CloudFightIcon>
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
                <img src={cloudFightScene} alt="" className="h-full w-full object-cover" />
                <CloudFightBars
                  attackerMarks={nightState.attackerAction}
                  snakeMarked={nightState.defenderAction.length}
                  skullMarked={nightState.defenderDefense.length}
                />
                <p
                  className="absolute left-[5%] top-[2%] font-display uppercase leading-none text-fg"
                  style={{ fontSize: labelFontSize }}
                >
                  Night {ordinalWord(snapshot.nightNumber)}
                </p>
              </div>
              <div style={{ height: gridHeight }}>
                <SymbolGrid arrangement={sheetConfig.arrangement} iconSrc={CLOUDFIGHT_ICON_SRC} revealedFaces={revealedFaces} />
              </div>
            </div>
          )}
        </div>
      </SheetArea>

      {/* CoinFrame — fixed height, same convention as every other Sheet. */}
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

      {/* ScoreFrame — fixed height, same convention as every other Sheet.
       * No TensionBar (that's bestof round-win-proximity specific);
       * NightSheetFooter alone, centered. */}
      <div className="flex h-[152px] shrink-0 flex-col items-center justify-center gap-2 border-t-2 border-fg bg-card px-4">
        <NightSheetFooter snapshot={snapshot} />
      </div>
    </div>
  )
}
