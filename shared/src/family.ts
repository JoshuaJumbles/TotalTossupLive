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
 * action), planks (humans' defense). */
export type BarricadeIcon = 'knife' | 'medkit' | 'planks';

/**
 * The Teamwork Family: two humans working together against the demons --
 * still the same Humans v. Demons competitive shape every Family follows,
 * just a different flavor of it per Sheet (Barricade's own theme: one
 * tending wounds, one hammering the barricade shut). Every round is a
 * fixed 4-flip sequence that resolves to one grid cell (see
 * symbolGrid.ts's resolveGridCell) and therefore one icon; `arrangement`
 * says which icon sits on each of the grid's 8 pairs' O/X side.
 *
 * The win shape itself turns out to be identical across every Teamwork
 * Sheet checked so far (Barricade and CloudFight both land on the exact
 * same 5/6/5 targets and 2:1:1 icon ratio -- confirmed against Figma, not
 * assumed): one team (`attacker`) has a single action track whose target
 * starts at `attackerAction.target` and grows by 1 for every mark the
 * *other* team lands on their own defense track -- the attacker wins by
 * reaching that (possibly pushed-back) target. The other team (the
 * "defender") has two independent ways to win: reach `defenderAction`'s
 * target on their own fixed track (never pushed back), or fully build out
 * `defenderDefense` (which also ends the Night immediately for them,
 * since that's what's been pushing the attacker's target out in the
 * first place). See teamwork.ts's own applyFlip for the actual
 * arithmetic this drives.
 *
 * Each track can be fed by one or more grid icons -- every Barricade
 * track has exactly one, but a Sheet can split one track across several
 * icons sharing a single score while still drawing marks on separate
 * per-icon lanes (CloudFight's jetpack/bow "handoff" -- see
 * TeamworkNightState's own doc comment for how that's represented). */
export interface TeamworkTrackConfig<TIcon extends string> {
  icons: TIcon[];
  target: number;
}

export interface TeamworkSheetConfig<TIcon extends string = string> extends SheetConfig {
  familyId: 'teamwork';
  arrangement: Record<number, { o: TIcon; x: TIcon }>;
  /** Which team's action track is the pushed-back one -- 'demons' in
   * Barricade (knife), 'humans' in CloudFight (jetpack/bow). */
  attacker: Side;
  attackerAction: TeamworkTrackConfig<TIcon>;
  defenderAction: TeamworkTrackConfig<TIcon>;
  defenderDefense: TeamworkTrackConfig<TIcon>;
}

/** One track's marks so far this Night, in order -- entry i is the icon
 * that claimed that track's (i+1)th slot. `.length` is the track's own
 * current count. For a track with only one possible icon (every
 * Barricade track, CloudFight's defenderAction/defenderDefense) every
 * entry is trivially the same value -- but keeping the shape uniform is
 * what lets one engine and one renderer handle both a single-icon track
 * and a multi-icon one (CloudFight's attackerAction, split visually
 * across jetpack/bow lanes by which icon actually claimed each slot)
 * with no special-casing. */
export type TeamworkTrackMarks<TIcon extends string> = TIcon[];

/** currentRound.flips grows to exactly 4 per round (Teamwork's round size
 * isn't a tunable config knob like bestof's roundSize -- it's fixed by the
 * grid's own 4-bit address space). The three tracks are cumulative across
 * the whole Night, same convention as BestOfNightState's roundPoints. */
export interface TeamworkNightState<TIcon extends string = string> {
  familyId: 'teamwork';
  currentRound: { roundIndex: number; flips: Flip[] };
  attackerAction: TeamworkTrackMarks<TIcon>;
  defenderAction: TeamworkTrackMarks<TIcon>;
  defenderDefense: TeamworkTrackMarks<TIcon>;
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
