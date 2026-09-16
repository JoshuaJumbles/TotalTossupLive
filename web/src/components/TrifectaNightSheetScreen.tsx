import type { ChannelSnapshot, TrifectaNightState, TrifectaSheetConfig } from '@total-tossup-live/shared'
import { ordinalWord } from '../lib/ordinal'
import { maskStyle } from '../lib/maskStyle'
import { useFitSheetWidth } from '../lib/useFitSheetWidth'
import { CoinRow } from './CoinRow'
import { NightSheetFooter } from './NightSheetFooter'
import { SheetArea } from './SheetArea'
import { TrifectaGrid } from './TrifectaGrid'
import { TrifectaMarks, type TrifectaMarkLayout } from './TrifectaMarks'

// The Trifecta Sheets' own scene frame runs slightly taller than the
// Teamwork ones' 409x311 (Joshua is double-checking the aspect math on
// his end) -- these are a general size approximation rather than an exact
// spec, and only need to hold the scene+grid stack's real proportions
// closely enough that TrifectaMarks' percentage-positioned marks land
// where the art expects. See useFitSheetWidth's own doc comment.
const SHEET_WIDTH_REF = 409
const SCENE_HEIGHT_REF = 315
const GRID_HEIGHT_REF = 166
const SHEET_ASPECT = SHEET_WIDTH_REF / (SCENE_HEIGHT_REF + GRID_HEIGHT_REF)

/** Everything that varies per Trifecta Sheet: the art itself, plus the
 * per-target mark geometry. The icon set and which side fields the three
 * elements are real game config (broadcast on ChannelSnapshot.sheetConfig)
 * rather than art, so they aren't repeated here. */
export interface TrifectaSheetArt<TIcon extends string> {
  /** Line-only art, alpha channel only -- tinted bg-fg so it tracks the
   * live color scheme, same as every Teamwork Sheet's scene. */
  sceneImage: string
  iconSrc: Record<TIcon, string>
  marks: TrifectaMarkLayout
  /** "Night N" label position as a percentage of the scene box, placed
   * per Sheet to sit in whatever open space its own art leaves. */
  labelLeft: string
  labelTop: string
}

interface TrifectaNightSheetScreenProps<TIcon extends string> {
  snapshot: ChannelSnapshot
  art: TrifectaSheetArt<TIcon>
}

/**
 * The shared screen for every Trifecta Sheet -- same layout skeleton as
 * TeamworkNightSheetScreen (SheetArea + scene + grid, then the fixed
 * CoinFrame and ScoreFrame), with Trifecta's own two differences: the
 * scene carries destruction marks rather than progress bars, and the grid
 * holds multi-symbol cells plus the Trifecta tile.
 *
 * See worker/src/families/trifecta.ts for the win math this renders: both
 * sides start with nine targets, a resolved cell deals damage to whichever
 * side didn't score it, and the Night ends when one side's nine are gone.
 */
export function TrifectaNightSheetScreen<TIcon extends string>({
  snapshot,
  art,
}: TrifectaNightSheetScreenProps<TIcon>) {
  const nightState = snapshot.nightState as TrifectaNightState<TIcon>
  const config = snapshot.sheetConfig as TrifectaSheetConfig<TIcon>
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
              <div className="relative border-[3px] border-fg bg-bg" style={{ height: sceneHeight }}>
                <div className="absolute inset-0 bg-fg" style={maskStyle(art.sceneImage)} />
                <TrifectaMarks nightState={nightState} layout={art.marks} />
                <p
                  className="absolute font-display uppercase leading-none text-fg"
                  style={{ left: art.labelLeft, top: art.labelTop, fontSize: labelFontSize }}
                >
                  Night {ordinalWord(snapshot.nightNumber)}
                </p>
              </div>
              <div style={{ height: gridHeight }}>
                <TrifectaGrid
                  arrangement={config.arrangement}
                  iconSrc={art.iconSrc}
                  elements={config.elements}
                  activated={nightState.activated}
                  revealedFaces={revealedFaces}
                />
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

      {/* ScoreFrame — fixed height, NightSheetFooter alone, centered. */}
      <div className="flex h-[152px] shrink-0 flex-col items-center justify-center gap-2 border-t-2 border-fg bg-card px-4">
        <NightSheetFooter snapshot={snapshot} />
      </div>
    </div>
  )
}
