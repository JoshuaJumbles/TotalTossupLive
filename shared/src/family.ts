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

/** The Teamwork Family: two humans working together against the demons
 * (Barricade's own theme — one tending wounds, one hammering the
 * barricade shut) — still the same Humans v. Demons competitive shape
 * every Family follows, just a different flavor of it. First-pass stub:
 * no real rules yet, just enough shape to verify the dispatch pathway —
 * see teamwork.ts for the (currently trivial) engine. */
export interface TeamworkSheetConfig extends SheetConfig {
  familyId: 'teamwork';
}

/** Stub shape — a round is still "some flips happened", same convention
 * every Family's NightState follows (see channelDurableObject.ts's
 * pendingFlipFor, which reads currentRound.flips off of whichever
 * Family's state this is). Real Barricade state (the tracker board's
 * knife/kit/board resources) lands once the mechanic itself is designed. */
export interface TeamworkNightState {
  familyId: 'teamwork';
  currentRound: { roundIndex: number; flips: Flip[] };
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
