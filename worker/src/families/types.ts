import type { CoinFace, Side, SheetConfig } from '@total-tossup-live/shared';

export interface FlipOutcome<TState> {
  state: TState;
  flipWinner: Side;
  /** True if this flip closed the current round (early-stop threshold hit). */
  roundClosed: boolean;
  roundWinner: Side | null;
  /** Non-null only if this flip also won the whole Night. */
  nightWinner: Side | null;
  /** How many base-length beats this round's own pause should run for --
   * 1 (the default) being the configured round_resolved duration, exactly
   * as before. A Family whose round can produce more than one thing to
   * watch asks for a proportionally longer window here, because the pause
   * length is what the coordinator schedules its alarm on: a client
   * animating past phaseEndsAt just gets cut off by the next flip, so the
   * window itself has to grow rather than the animation being crammed
   * into it. Trifecta is the first Family that needs this -- a round
   * there can destroy up to three targets, and each one gets a full
   * CrossOutMark reveal at its natural speed (see trifecta.ts). */
  pauseScale?: number;
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
