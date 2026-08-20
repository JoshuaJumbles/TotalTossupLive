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

/** Barricade's own icon set -- knife (demons' action, no defense), medkit
 * (humans' action), planks (humans' defense). */
export type BarricadeIcon = 'knife' | 'medkit' | 'planks';

/** CloudFight's own icon set -- jetpack/bow (humans' action, split across
 * two lanes sharing one score -- see TeamworkTrackMarks' own doc
 * comment), snake (demons' action), skull (demons' defense). Roles are
 * flipped from Barricade's (humans have no defense here, demons do),
 * confirmed against the real Figma coordinates rather than assumed. */
export type CloudFightIcon = 'jetpack' | 'bow' | 'snake' | 'skull';

/** Inferno's own icon set -- fire (demons' action, no defense, same
 * shape as Barricade's knife), water (humans' action), shield (humans'
 * defense). A clean reskin of Barricade's exact asymmetric shape --
 * confirmed against the real Figma coordinates: fire appears in 8 of the
 * grid's 16 cells, water and shield each in 4, matching Barricade's own
 * 8:4:4 ratio exactly. */
export type InfernoIcon = 'fire' | 'water' | 'shield';

/** Rooftop's own icon set -- the finale Sheet, and the first genuinely
 * new shape: both sides have both tracks (spear/guns split -- same
 * "handoff" mechanic as CloudFight's own jetpack/bow -- and music for
 * humans' action/defense; blast and crystal for demons'). The grid's own
 * icon ratio is 1:1 between each side's action and defense (4 spear+guns,
 * 4 music, 4 blast, 4 crystal -- unlike every other Sheet's 2:1), which
 * is why both defense tracks here carry a fractional `pushValue` (see
 * TeamworkTrackConfig's own doc comment) rather than the default 1. */
export type RooftopIcon = 'spear' | 'guns' | 'music' | 'blast' | 'crystal';

/** RiverShark's own icon set -- shark (demons' action, no defense), gun
 * (humans' action), oar (humans' defense). Another clean reskin of
 * Barricade's exact asymmetric shape, same as Inferno -- confirmed
 * against the real Figma coordinates: shark appears in 8 of the grid's
 * 16 cells, gun and oar each in 4, matching the same 8:4:4 ratio. */
export type RiverSharkIcon = 'shark' | 'gun' | 'oar';

/** Portal's own icon set -- the last Teamwork Sheet, and CloudFight's
 * shape with the split side flipped: demons' own action is split across
 * bat+chain, sharing one score (the same "handoff" mechanic as
 * CloudFight's jetpack/bow, just on demons' side this time rather than
 * humans'), with no defense; humans have both, book as their own fixed
 * action track and ladder as their defense track. Confirmed against the
 * real Figma coordinates: bat and chain occupy the same 9 x-positions on
 * two separate rows (exactly CloudFight's own split-lane layout), and
 * each of the grid's 4 icons appears in exactly 4 of the 16 cells (bat+
 * chain combined = 8, book = 4, ladder = 4 -- the same 8:4:4 weighting
 * as every other Sheet, just split across two icons on the 8 side). */
export type PortalIcon = 'bat' | 'book' | 'chain' | 'ladder';

/**
 * The Teamwork Family: two humans working together against the demons --
 * still the same Humans v. Demons competitive shape every Family follows,
 * just a different flavor of it per Sheet (Barricade's own theme: one
 * tending wounds, one hammering the barricade shut). Every round is a
 * fixed 4-flip sequence that resolves to one grid cell (see
 * symbolGrid.ts's resolveGridCell) and therefore one icon; `arrangement`
 * says which icon sits on each of the grid's 8 pairs' O/X side.
 *
 * Each side (`humans`/`demons`) has a required `action` track and an
 * optional `defense` track -- "optional" is what makes this shape cover
 * every Sheet seen so far: Barricade and CloudFight are both the
 * asymmetric case where only one side has a `defense` (Barricade's
 * humans, via planks; CloudFight's demons, via skull), while a Sheet like
 * Rooftop (still ahead) gives *both* sides one. A side's own `action`
 * target isn't fixed, though -- it grows by however much value the
 * *other* side's `defense` track currently holds (see `pushValue` below),
 * so reaching your action target means outrunning whatever the opponent
 * has managed to build. A side wins the Night by either reaching its own
 * (possibly pushed-back) action target, or by fully building out its own
 * `defense` track -- which, being what's been doing the pushing, also
 * means the Night is over the moment it happens. See teamwork.ts's own
 * applyFlip for the actual arithmetic this drives.
 *
 * Each track can be fed by one or more grid icons -- most tracks checked
 * so far have exactly one, but a Sheet can split one track across several
 * icons sharing a single score while still drawing marks on separate
 * per-icon lanes (CloudFight's jetpack/bow "handoff" -- see
 * TeamworkNightState's own doc comment for how that's represented). */
export interface TeamworkTrackConfig<TIcon extends string> {
  icons: TIcon[];
  target: number;
  /** How much one mark on this track is worth when it pushes back the
   * *other* side's action target -- defaults to 1 (every mark is a full
   * point of pushback), only ever set below 1 on a defense track. Exists
   * for Rooftop (still ahead): its action:defense icon ratio is 1:1
   * rather than every other Sheet's 2:1, so defense would fill too fast
   * relative to its own shorter distance-to-win -- each mark there is
   * only worth 0.5, so two marks build one full "defended point," always
   * rounded down when computing pushback (see teamwork.ts's own
   * `pushback()`). A track's own win condition is unaffected by this --
   * see `defenseWinMarks()` for how a fractional pushValue changes how
   * many raw marks a defense track needs to win *by itself*, since
   * "half-built" doesn't round down the same way there. */
  pushValue?: number;
}

/** One side's own two tracks. `defense` is optional -- a side with none
 * simply never pushes the opponent's action target out, and can never
 * win by defense-completion; its `defense` marks in TeamworkSideState
 * just stay permanently empty. */
export interface TeamworkSideConfig<TIcon extends string> {
  action: TeamworkTrackConfig<TIcon>;
  defense?: TeamworkTrackConfig<TIcon>;
}

export interface TeamworkSheetConfig<TIcon extends string = string> extends SheetConfig {
  familyId: 'teamwork';
  arrangement: Record<number, { o: TIcon; x: TIcon }>;
  humans: TeamworkSideConfig<TIcon>;
  demons: TeamworkSideConfig<TIcon>;
}

/** One track's marks so far this Night, in order -- entry i is the icon
 * that claimed that track's (i+1)th slot. `.length` is the track's own
 * current count. For a track with only one possible icon every entry is
 * trivially the same value -- but keeping the shape uniform is what lets
 * one engine and one renderer handle both a single-icon track and a
 * multi-icon one (CloudFight's humans action track, split visually across
 * jetpack/bow lanes by which icon actually claimed each slot) with no
 * special-casing. */
export type TeamworkTrackMarks<TIcon extends string> = TIcon[];

/** One side's own marks so far -- `defense` is always a real (possibly
 * empty) array here even for a side whose SheetConfig has no `defense`
 * track at all, so the engine and renderer never need to null-check it. */
export interface TeamworkSideState<TIcon extends string> {
  action: TeamworkTrackMarks<TIcon>;
  defense: TeamworkTrackMarks<TIcon>;
}

/** currentRound.flips grows to exactly 4 per round (Teamwork's round size
 * isn't a tunable config knob like bestof's roundSize -- it's fixed by the
 * grid's own 4-bit address space). Both sides' tracks are cumulative
 * across the whole Night, same convention as BestOfNightState's
 * roundPoints. */
export interface TeamworkNightState<TIcon extends string = string> {
  familyId: 'teamwork';
  currentRound: { roundIndex: number; flips: Flip[] };
  humans: TeamworkSideState<TIcon>;
  demons: TeamworkSideState<TIcon>;
}

/** Which screen component renders a Night playing this Sheet. 'simple' is
 * the plain numeric debug view; 'battle' is the unit-grid + coin-row
 * visual; 'barricade', 'cloudfight', 'inferno', 'rooftop', 'rivershark',
 * and 'portal' are Teamwork's own Sheets -- all six now planned are
 * built -- sharing both the same engine and the same generic screen
 * component (TeamworkNightSheetScreen, driven by a per-Sheet `art` data
 * bundle) -- this is the dispatch key, not the theme/art itself. More
 * styles arrive as more visually-distinct Sheets do. */
export type SheetStyle = 'simple' | 'battle' | 'barricade' | 'cloudfight' | 'inferno' | 'rooftop' | 'rivershark' | 'portal';

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
