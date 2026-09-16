import type { ChannelSnapshot, Side, TrifectaNightState, TrifectaSheetConfig } from '@total-tossup-live/shared'
import { ordinalWord } from '../lib/ordinal'
import { CoinRow } from './CoinRow'
import { NightSheetFooter } from './NightSheetFooter'
import { PhaseBanner } from './PhaseBanner'

interface TrifectaDebugScreenProps {
  snapshot: ChannelSnapshot
  progress: number
}

const SIDE_LABEL: Record<Side, string> = { humans: 'Humans', demons: 'Demons' }
const SIDE_COLOR: Record<Side, string> = { humans: 'text-humans', demons: 'text-demons' }

/**
 * A numbers-only view of a Trifecta Night, deliberately standing in for
 * the real Sheet art until it lands -- the same role the plain 'simple'
 * view plays for the bestof Family. It shows the three things the engine
 * actually tracks (see worker/src/families/trifecta.ts): how many of each
 * side's nine targets are still standing, which of the Trifecta side's
 * elements have been activated, and therefore what the Trifecta tile is
 * currently worth.
 *
 * Nothing here is Sheet-specific -- which side fields the three elements
 * comes from config.trifectaSide -- so every Trifecta Sheet can sit on
 * this view until its own art exists.
 */
export function TrifectaDebugScreen({ snapshot, progress }: TrifectaDebugScreenProps) {
  const nightState = snapshot.nightState as TrifectaNightState
  const config = snapshot.sheetConfig as TrifectaSheetConfig
  const phaseDurationMs = snapshot.phaseEndsAt - snapshot.phaseStartedAt

  const uniformSide: Side = config.trifectaSide === 'humans' ? 'demons' : 'humans'
  const totalTargets = config.targets[config.trifectaSide].length

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-5 px-6 pb-6">
      <p className="font-display text-3xl uppercase text-fg sm:text-4xl">
        Night {ordinalWord(snapshot.nightNumber)}
      </p>

      <PhaseBanner phase={snapshot.phase} progress={progress} />

      <div className="w-full max-w-sm">
        <CoinRow
          slots={4}
          flips={nightState.currentRound.flips}
          isFlipping={snapshot.phase === 'flipping'}
          phaseDurationMs={phaseDurationMs}
          flipKey={snapshot.pendingFlip?.sequenceIndex ?? -1}
        />
      </div>

      <div className="flex w-full max-w-sm flex-col gap-2">
        {([uniformSide, config.trifectaSide] as Side[]).map((side) => {
          const standing = totalTargets - nightState.destroyed[side].length
          return (
            <div key={side} className="flex items-baseline justify-between border-b-2 border-fg pb-1">
              <p className={`font-display text-xl uppercase ${SIDE_COLOR[side]}`}>
                {SIDE_LABEL[side]}
                {side === config.trifectaSide && <span className="font-body text-xs text-fg"> (trifecta)</span>}
              </p>
              <p className="font-display text-2xl text-fg">
                {standing} / {totalTargets}
              </p>
            </div>
          )
        })}
      </div>

      {/* The tile's own readout: which elements have shown up, and so what
       * a hit on it is worth right now (zero until something lights it). */}
      <div className="flex flex-col items-center gap-1">
        <p className="font-body text-xs font-light uppercase tracking-wide text-fg">Trifecta tile</p>
        <div className="flex gap-3">
          {config.elements.map((element) => {
            const isActive = nightState.activated.includes(element)
            return (
              <p
                key={element}
                className={`font-body text-sm uppercase ${isActive ? 'font-bold text-fg' : 'font-light text-fg/40'}`}
              >
                {isActive ? '●' : '○'} {element}
              </p>
            )
          })}
        </div>
        <p className="font-display text-lg text-fg">worth {nightState.activated.length} dmg</p>
      </div>

      <NightSheetFooter snapshot={snapshot} />
    </div>
  )
}
