import type { CoinFace, Side, SheetConfig } from '@total-tossup-live/shared';

export interface FlipOutcome<TState> {
  state: TState;
  flipWinner: Side;
  /** True if this flip closed the current round (early-stop threshold hit). */
  roundClosed: boolean;
  roundWinner: Side | null;
  /** Non-null only if this flip also won the whole Night. */
  nightWinner: Side | null;
}

/**
 * A Family is a rules engine: given a Sheet's config, it knows how to
 * initialize a Night, apply one resolved coin flip, and reset for the next
 * round. The coordinator (ChannelDurableObject) knows nothing about *how* a
 * Night is won — only phases, timing, and Night→Week→Season→History
 * bookkeeping — so this is the entire seam a new Family plugs into.
 */
export interface FamilyEngine<TState, TConfig extends SheetConfig> {
  initNight(config: TConfig): TState;
  applyFlip(state: TState, config: TConfig, face: CoinFace): FlipOutcome<TState>;
  /** Called when a round_resolved pause ends and the Night continues. */
  startNextRound(state: TState): TState;
}
