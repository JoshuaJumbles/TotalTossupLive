import type { ChannelSnapshot, CoinFace, TeamworkNightState, TeamworkSheetConfig } from '@total-tossup-live/shared'
import { resolveGridCell } from '@total-tossup-live/shared'
import { ordinalWord } from '../lib/ordinal'
import { maskStyle } from '../lib/maskStyle'
import { useFitSheetWidth } from '../lib/useFitSheetWidth'
import { CoinRow } from './CoinRow'
import { NightSheetFooter } from './NightSheetFooter'
import { SheetArea } from './SheetArea'
import { SymbolGrid } from './SymbolGrid'
import { TeamworkBars, type TeamworkBarLayout } from './TeamworkBars'

// Every Teamwork Sheet's own Figma scene frame has landed on this exact
// 409x311 (+166 grid) proportion so far (Barricade's own BarricadeScene,
// CloudFight's own CloudFightScene) -- see useFitSheetWidth's own doc
// comment for why locking the rendered box to this exact ratio is what
// keeps TeamworkBars' percentage-positioned marks correct with no further
// math. A future Sheet with genuinely different real proportions would
// need these to become per-Sheet `art` fields rather than shared
// constants -- not needed yet.
const SHEET_WIDTH_REF = 409
const SCENE_HEIGHT_REF = 311
const GRID_HEIGHT_REF = 166
const SHEET_ASPECT = SHEET_WIDTH_REF / (SCENE_HEIGHT_REF + GRID_HEIGHT_REF)

/** Everything that varies per Sheet: the art itself, plus the two pieces
 * of per-icon data (bar geometry, grid icon src) that used to live in
 * each Sheet's own dedicated screen/bars component pair before this
 * generalization. See barricadeSheetArt.ts/cloudFightSheetArt.ts for both
 * existing Sheets' own values. */
export interface TeamworkSheetArt<TIcon extends string> {
  /** Line-only art, alpha channel only (Josh's own "just the lines with
   * transparent background" export) -- rendered via the same mask-and-
   * tint technique as every other line-art asset (TeamArt, CrossOutMark,
   * SymbolGrid's own icons), tinted bg-fg so it tracks the live color
   * scheme instead of staying fixed to whatever ink color the original
   * flat PNG happened to bake in. */
  sceneImage: string
  iconSrc: Record<TIcon, string>
  barLayout: TeamworkBarLayout<TIcon>
  /** "Night N" label position, as a percentage of the scene box --
   * differs per Sheet since it's placed to sit in whatever open space
   * each scene's own art happens to leave (Barricade's own '24.7%/2.3%'
   * vs CloudFight's '5%/2%', both placeholders pending real visual
   * feedback per Sheet, same as before this generalization). */
  labelLeft: string
  labelTop: string
}

interface TeamworkNightSheetScreenProps<TIcon extends string> {
  snapshot: ChannelSnapshot
  art: TeamworkSheetArt<TIcon>
}

/**
 * The shared screen for every Teamwork Sheet (Barricade, CloudFight, and
 * whatever comes next) -- generalized from what used to be a near-
 * duplicate BarricadeNightSheetScreen/CloudFightNightSheetScreen pair,
 * with the only real per-Sheet differences (scene art, bar geometry, grid
 * icon src, label position) now data (`art`) rather than separate
 * components. See worker/src/families/teamwork.ts for the real 4-flip-
 * per-round win math this renders.
 *
 * Layout: AppHeader (fixed, in App.tsx) + SheetArea (flexible — see its
 * own doc comment) + CoinFrame + ScoreFrame, both fixed heights matching
 * Josh's own target spec (Figma node 254:1236).
 *
 * Inside SheetArea, useFitSheetWidth locks the scene+grid stack to the
 * largest size that fits while holding its own real aspect ratio — so
 * TeamworkBars' percentage-positioned marks and the "Night N" label (font
 * size scaled to the fitted width) both resolve correctly at any viewport
 * size, with no further per-viewport math.
 */
export function TeamworkNightSheetScreen<TIcon extends string>({ snapshot, art }: TeamworkNightSheetScreenProps<TIcon>) {
  const nightState = snapshot.nightState as TeamworkNightState<TIcon>
  const sheetConfig = snapshot.sheetConfig as TeamworkSheetConfig<TIcon>
  const phaseDurationMs = snapshot.phaseEndsAt - snapshot.phaseStartedAt
  const revealedFaces = nightState.currentRound.flips.map((flip) => flip.face)

  // The icon this round resolved to, once round_resolved's own pause has
  // all 4 flips revealed -- derived client-side via the same pure
  // resolveGridCell the worker itself uses (shared/src/symbolGrid.ts),
  // rather than a new broadcast field, since every input this needs
  // (the round's own flips, sheetConfig's own arrangement) is already
  // present in ChannelSnapshot. Drives TeamworkBars' own hand-drawn
  // reveal for exactly the one mark that just landed; null the rest of
  // the time, including every later render of this same resolved round
  // once startNextRound() has moved on.
  const isRoundResolved =
    snapshot.phase === 'round_resolved' && revealedFaces.length === 4 && revealedFaces.every((face): face is CoinFace => face != null)
  const justResolvedIcon = isRoundResolved
    ? (() => {
        const { pairIndex, side } = resolveGridCell(revealedFaces as [CoinFace, CoinFace, CoinFace, CoinFace])
        return sheetConfig.arrangement[pairIndex][side]
      })()
    : null

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
                <TeamworkBars
                  nightState={nightState}
                  layout={art.barLayout}
                  justResolvedIcon={justResolvedIcon}
                  phaseDurationMs={phaseDurationMs}
                />
                <p
                  className="absolute font-display uppercase leading-none text-fg"
                  style={{ left: art.labelLeft, top: art.labelTop, fontSize: labelFontSize }}
                >
                  Night {ordinalWord(snapshot.nightNumber)}
                </p>
              </div>
              <div style={{ height: gridHeight }}>
                <SymbolGrid arrangement={sheetConfig.arrangement} iconSrc={art.iconSrc} revealedFaces={revealedFaces} />
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

      {/* ScoreFrame — fixed height. No TensionBar (that's bestof
       * round-win-proximity specific); NightSheetFooter alone, centered. */}
      <div className="flex h-[152px] shrink-0 flex-col items-center justify-center gap-2 border-t-2 border-fg bg-card px-4">
        <NightSheetFooter snapshot={snapshot} />
      </div>
    </div>
  )
}
