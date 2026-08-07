import type { Side } from './scoring';

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

export interface Sheet {
  id: string;
  familyId: string;
  name: string;
  config: SheetConfig;
}
