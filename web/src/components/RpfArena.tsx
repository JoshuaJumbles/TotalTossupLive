import type { CoinFace, RpfCharacter, RpfNightState, RpfSheetConfig, RpfType, Side } from '@total-tossup-live/shared'
import {
  CHARACTER_FRAC,
  CHARACTER_RADIUS_FRAC,
  DOT_GAP_DEG,
  DOT_RADIUS_FRAC,
  DOT_SIZE_FRAC,
  NAME_RADIUS_FRAC,
  RING_IMAGE_FRAC,
  RING_SCALE,
  SYMBOL_FRAC,
  SYMBOL_SHIFT_DEG,
  angleFor,
  polar,
  span,
} from '../lib/rpfRing'
import { RpfArrows } from './RpfArrows'

/** A fighter is still in contention while every flip that has landed
 * agrees with its index. Two flips address a side, most significant
 * first, so the first narrows four fighters to two and the second to one
 * -- the same bit-matching the symbol grid's narrowing uses. */
function stillPossible(index: number, bits: (CoinFace | null)[]): boolean {
  const high = (index >> 1) & 1
  const low = index & 1
  if (bits[0] && high !== (bits[0] === 'heads' ? 1 : 0)) return false
  if (bits[1] && low !== (bits[1] === 'heads' ? 1 : 0)) return false
  return true
}

function pickedIndex(bits: (CoinFace | null)[]): number | null {
  if (!bits[0] || !bits[1]) return null
  return (bits[0] === 'heads' ? 2 : 0) + (bits[1] === 'heads' ? 1 : 0)
}

export type RpfSymbolSrc = Record<`${RpfType}${0 | 1}`, string>

export interface RpfArenaArt {
  ring: string
  /** Keyed by RpfCharacter.art. */
  characters: Record<string, string>
  /** Joshua's symbol art comes in a pair per type -- 0 for the left of
   * the ring, 1 for the right -- so the two sides read differently even
   * when they play the same hand. */
  symbols: RpfSymbolSrc
}

interface RpfArenaProps {
  nightState: RpfNightState
  config: RpfSheetConfig
  art: RpfArenaArt
  /** Rendered width of the square arena box, in px -- needed only for
   * font sizing, which can't be expressed as a percentage. */
  size: number
  /** The pause clock, passed through to the arrows so the one that just
   * landed draws itself. */
  phaseStartedAt: number
  phaseDurationMs?: number
}

/**
 * The ring: eight fighters, four to a side, with their names printed
 * around the outside, their Rock/Paper/Scissors/Royalty symbol just
 * inside, and a health dot for each point they can take.
 *
 * As flips land, fighters that can no longer be chosen fade back, so the
 * ring narrows to the two who will actually meet -- the same reading aid
 * the symbol grid gives the Teamwork and Trifecta Sheets.
 */
export function RpfArena({ nightState, config, art, size, phaseStartedAt, phaseDurationMs }: RpfArenaProps) {
  const leftSide = config.leftSide
  const rightSide: Side = leftSide === 'humans' ? 'demons' : 'humans'
  const faces = nightState.currentRound.flips.map((flip) => flip.face)
  const settled = nightState.lastRound

  const sideBits: Record<Side, (CoinFace | null)[]> = {
    [leftSide]: [faces[0] ?? null, faces[1] ?? null],
    [rightSide]: [faces[2] ?? null, faces[3] ?? null],
  } as Record<Side, (CoinFace | null)[]>

  const healthOf = (fighter: RpfCharacter) =>
    fighter.type === 'royalty' ? config.royaltyHealth : config.rpsHealth

  return (
    <div className="absolute inset-0">
      <img
        src={art.ring}
        alt=""
        className="absolute object-contain"
        style={{
          left: '50%',
          top: '50%',
          width: span(RING_IMAGE_FRAC),
          height: span(RING_IMAGE_FRAC),
          transform: 'translate(-50%, -50%)',
        }}
      />

      <RpfArrows
        nightState={nightState}
        config={config}
        phaseStartedAt={phaseStartedAt}
        phaseDurationMs={phaseDurationMs}
      />

      {([leftSide, rightSide] as Side[]).map((side) => {
        const onLeft = side === leftSide
        const bits = sideBits[side]
        const chosen = pickedIndex(bits)
        // Once a side's pick is known and that fighter is already down,
        // the blow will carry through to their Royalty -- flagged on the
        // ring before the round even resolves, which is the one piece of
        // drama this Family gives away early.
        const chosenDown =
          chosen !== null &&
          nightState.damage[side][chosen] >= healthOf(config.lineup[side][chosen])
        const royalIndex = config.lineup[side].findIndex((f) => f.type === 'royalty')

        return config.lineup[side].map((fighter, index) => {
          const angle = angleFor(index, onLeft)
          const possible = stillPossible(index, bits)
          const damage = nightState.damage[side][index]
          const health = healthOf(fighter)
          const down = damage >= health
          const isWeakSpotTarget = chosenDown && index === royalIndex

          const symbolAngle = angle + (onLeft ? -SYMBOL_SHIFT_DEG : SYMBOL_SHIFT_DEG)
          const symbolKey = `${fighter.type}${onLeft ? 0 : 1}` as keyof RpfSymbolSrc

          return (
            <div key={`${side}-${index}`}>
              {/* The fighter. Rendered as plain art rather than tinted:
               * unlike every other Sheet's line work these carry opaque
               * white fills, so masking them would turn each one into a
               * silhouette. Proper recolouring wants fill/line pairs, the
               * way TeamArt does it. */}
              <div
                className="absolute transition-opacity duration-300"
                style={{
                  ...polar(angle, CHARACTER_RADIUS_FRAC),
                  width: span(CHARACTER_FRAC),
                  height: span(CHARACTER_FRAC),
                  transform: 'translate(-50%, -50%)',
                  opacity: down ? 0.25 : possible ? 1 : 0.3,
                  filter: down ? 'grayscale(1)' : undefined,
                }}
              >
                <img
                  src={art.characters[fighter.art]}
                  alt=""
                  className="h-full w-full object-contain"
                  // The art is drawn for the default arrangement -- humans
                  // on the left of the ring, demons on the right -- so each
                  // fighter already faces the centre there. When a Sheet
                  // swaps the courts, both sides are looking outward, and
                  // mirroring puts them back face to face. Same thing
                  // CharacterManager.pde does with flipHorizontal when it
                  // loads the switched-side roster.
                  style={{ transform: (side === 'humans') !== onLeft ? 'scaleX(-1)' : undefined }}
                />
                {isWeakSpotTarget && (
                  <div
                    className="absolute inset-0 animate-pulse rounded-full"
                    style={{
                      background: `radial-gradient(circle, var(--color-${side === 'humans' ? 'demons' : 'humans'}) 0%, transparent 70%)`,
                      opacity: 0.45,
                    }}
                  />
                )}
              </div>

              {/* Name, printed along the ring the way the sheet prints it. */}
              <div
                className="absolute whitespace-nowrap font-display uppercase leading-none text-fg transition-opacity duration-300"
                style={{
                  ...polar(angle, NAME_RADIUS_FRAC),
                  fontSize: size * 0.032 * RING_SCALE,
                  transform: `translate(-50%, -50%) rotate(${angle + 90}deg)`,
                  opacity: possible && !down ? 1 : 0.3,
                }}
              >
                {fighter.name}
              </div>

              {/* Rock / Paper / Scissors / Royalty. */}
              <div
                className="absolute transition-opacity duration-300"
                style={{
                  ...polar(symbolAngle, 0.5 - SYMBOL_FRAC / 2),
                  width: span(SYMBOL_FRAC),
                  height: span(SYMBOL_FRAC),
                  transform: 'translate(-50%, -50%)',
                  opacity: possible && !down ? 1 : 0.3,
                }}
              >
                <img src={art.symbols[symbolKey]} alt="" className="h-full w-full object-contain" />
              </div>

              {/* One dot per point of health, fanned around the fighter's
               * own angle exactly as drawHealthCircles does. */}
              {Array.from({ length: health }, (_, dot) => {
                const offset = (dot - (health - 1) / 2) * DOT_GAP_DEG
                const struck = dot < damage
                const justStruck =
                  struck &&
                  dot === damage - 1 &&
                  settled !== null &&
                  settled.attacker !== side &&
                  settled.defenderIndex === index
                return (
                  <div
                    key={dot}
                    className="absolute rounded-full border-2 border-fg"
                    style={{
                      ...polar(angle + offset, DOT_RADIUS_FRAC),
                      width: span(DOT_SIZE_FRAC),
                      height: span(DOT_SIZE_FRAC),
                      transform: `translate(-50%, -50%) scale(${justStruck ? 1.35 : 1})`,
                      background: struck
                        ? `var(--color-${side === 'humans' ? 'demons' : 'humans'})`
                        : 'var(--color-bg)',
                      transition: 'transform 250ms ease-out, background-color 250ms ease-out',
                    }}
                  />
                )
              })}
            </div>
          )
        })
      })}
    </div>
  )
}
