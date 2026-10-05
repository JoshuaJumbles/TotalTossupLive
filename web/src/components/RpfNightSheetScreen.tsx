import type { ChannelSnapshot, RpfNightState, RpfSheetConfig } from '@total-tossup-live/shared'
import { ordinalWord } from '../lib/ordinal'
import { useFitSheetWidth } from '../lib/useFitSheetWidth'
import { CoinRow } from './CoinRow'
import { NightSheetFooter } from './NightSheetFooter'
import { SheetArea } from './SheetArea'
import { RpfArena, type RpfArenaArt } from './RpfArena'

/** The arena is square, and the Sheet is that plus a title strip -- the
 * printed sheet's own proportions. */
const SHEET_ASPECT = 1 / 1.12

/** Four flips pick the matchup; the fifth is the tiebreaker, which only
 * some rounds need. The slot is always shown so the row doesn't resize
 * mid-round -- Joshua's own call for the first pass. */
const COIN_SLOTS = 5

interface RpfNightSheetScreenProps {
  snapshot: ChannelSnapshot
  art: RpfArenaArt
}

/**
 * Rock Paper Flipper's Night screen: the ring, the coin row, the score.
 *
 * Unlike the grid Families there's no board to read -- the ring itself is
 * the board, and the narrowing happens on the fighters as each flip lands
 * (see RpfArena).
 */
export function RpfNightSheetScreen({ snapshot, art }: RpfNightSheetScreenProps) {
  const nightState = snapshot.nightState as RpfNightState
  const config = snapshot.sheetConfig as RpfSheetConfig
  const phaseDurationMs = snapshot.phaseEndsAt - snapshot.phaseStartedAt
  // The arrow that just landed draws itself during whichever pause the
  // round came to rest in -- not during 'flipping', where the previous
  // round's arrow should simply be shown finished.
  const isPause = snapshot.phase !== 'flipping'

  const { ref: sheetAreaRef, width } = useFitSheetWidth(SHEET_ASPECT)
  const labelFontSize = (width * 24) / 409

  return (
    <div className="flex h-full w-full flex-col">
      <SheetArea>
        <div ref={sheetAreaRef} className="flex h-full w-full items-center justify-center">
          {width > 0 && (
            <div className="flex flex-col items-center" style={{ width }}>
              <p
                className="font-display uppercase leading-none text-fg"
                style={{ fontSize: labelFontSize }}
              >
                Night {ordinalWord(snapshot.nightNumber)}
              </p>
              {/* The printed sheet carries this as its own subtitle, and
                * it genuinely changes how a Night plays, so it belongs on
                * screen rather than only in config. */}
              <p className="font-body uppercase text-fg" style={{ fontSize: labelFontSize * 0.45 }}>
                Princelings are {config.royaltyStrength}
              </p>
              <div className="relative mt-1" style={{ width, height: width }}>
                <RpfArena
                  nightState={nightState}
                  config={config}
                  art={art}
                  size={width}
                  phaseStartedAt={snapshot.phaseStartedAt}
                  phaseDurationMs={isPause ? phaseDurationMs : undefined}
                  // Stable for a Night and different on the next one, so
                  // wound drawings vary run to run without ever
                  // disagreeing between viewers.
                  variantSeed={`${snapshot.seasonNumber}:${snapshot.weekNumber}:${snapshot.nightNumber}:${snapshot.sheetId}`}
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
            slots={COIN_SLOTS}
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
