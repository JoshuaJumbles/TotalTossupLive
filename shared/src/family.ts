import type { ContainerScore, Side } from './scoring';

export type CoinFace = 'heads' | 'tails';

/** One coin flip. `face` and `winner` are null until the reveal moment
 * (phaseEndsAt of a 'flipping' phase) — the result is decided and logged
 * server-side immediately, but withheld from broadcast until then. */
export interface Flip {
  sequenceIndex: number;
  face: CoinFace | null;
  winner: Side | null;
}

/**
 * A Family is a rules engine identified by this id (implemented in code,
 * in the worker). A Sheet is a themed, data-driven configuration of a
 * Family — this is the base shape every Sheet's config extends.
 */
export interface SheetConfig {
  familyId: string;
}

/** The debug/practice Family: best-of-`roundSize` rounds (early stop at
 * `roundWinThreshold` flip-wins), race to `targetRoundPoints` round-wins
 * to take the Night. */
export interface BestOfSheetConfig extends SheetConfig {
  familyId: 'bestof';
  roundSize: number; // e.g. 5
  roundWinThreshold: number; // e.g. 3 (first to 3 of 5)
  targetRoundPoints: number; // e.g. 10
}

/** Barricade's own icon set -- knife (demons' action), medkit (humans'
 * action), planks (humans' defense). Concrete to Barricade rather than a
 * generic type param: only one Teamwork Sheet exists so far, so there's
 * nothing yet to generalize against (see teamwork.ts's own note on this
 * same trade-off) -- revisit once a second Teamwork Sheet needs a
 * different icon set. */
export type BarricadeIcon = 'knife' | 'medkit' | 'planks';

/** The Teamwork Family: two humans working together against the demons
 * (Barricade's own theme — one tending wounds, one hammering the
 * barricade shut) — still the same Humans v. Demons competitive shape
 * every Family follows, just a different flavor of it. Every round is a
 * fixed 4-flip sequence that resolves to one grid cell (see
 * symbolGrid.ts's resolveGridCell) and therefore one icon; `arrangement`
 * says which icon sits on each of the grid's 8 pairs' O/X side.
 *
 * Win math (teamwork.ts's own applyFlip has the real arithmetic): humans
 * win by reaching `targetMedkit` medkit hits OR `targetBarricade`
 * barricade hits; demons win by reaching `baseTargetKnife + <barricade
 * hits so far>` knife hits -- each barricade hit pushes the demons' own
 * target out by one, "defending" against it. */
export interface TeamworkSheetConfig extends SheetConfig {
  familyId: 'teamwork';
  arrangement: Record<number, { o: BarricadeIcon; x: BarricadeIcon }>;
  targetMedkit: number;
  targetBarricade: number;
  baseTargetKnife: number;
}

/** currentRound.flips grows to exactly 4 per round (Teamwork's round size
 * isn't a tunable config knob like bestof's roundSize -- it's fixed by the
 * grid's own 4-bit address space). The three counts are cumulative across
 * the whole Night, same convention as BestOfNightState's roundPoints. */
export interface TeamworkNightState {
  familyId: 'teamwork';
  currentRound: { roundIndex: number; flips: Flip[] };
  medkitCount: number;
  knifeCount: number;
  barricadeCount: number;
}

/** Which screen component renders a Night playing this Sheet. 'simple' is
 * the plain numeric debug view; 'battle' is the unit-grid + coin-row
 * visual; 'barricade' is Teamwork's own (currently two static Figma
 * exports — see BarricadeNightSheetScreen). More styles arrive as more
 * visually-distinct Sheets do — this is the dispatch key, not the
 * theme/art itself. */
export type SheetStyle = 'simple' | 'battle' | 'barricade';

export interface Sheet {
  id: string;
  familyId: string;
  name: string;
  style: SheetStyle;
  config: SheetConfig;
}

/** One best-of-`roundSize` round in progress: flips resolved so far this
 * round (fully revealed, permanent record) and the running flip-win tally. */
export interface BestOfRoundState {
  roundIndex: number;
  flips: Flip[];
  flipWins: ContainerScore;
}

export interface BestOfNightState {
  familyId: 'bestof';
  roundPoints: ContainerScore; // race-to-target round-wins
  currentRound: BestOfRoundState;
  completedRounds: number;
}

/** Union of all Family-specific Night states carried on ChannelSnapshot. */
export type NightState = BestOfNightState | TeamworkNightState;
