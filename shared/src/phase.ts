/**
 * The coordinator's phase enum. Exactly one of these is active at a time,
 * driven by the Durable Object's alarm loop. Clients never receive "do this
 * now" events — only a phase + absolute start/end timestamps — so any
 * viewer (new or reconnecting) can compute "how far into this phase are we"
 * locally and render in sync with everyone else.
 */
export type GamePhase =
  | 'flipping' // one coin flip is animating; face is null until phaseEndsAt
  | 'round_resolved' // a best-of-N round just concluded
  | 'night_won' // race-to-target round points hit; Night's points awarded to Week
  | 'week_won' // all Nights in the Week played; Week's points awarded to Season
  | 'season_won'; // all Weeks in the Season played; History incremented

/** Default durations in ms, per settled design. Take-max applies when a
 * single flip closes multiple containers at once (e.g. the last Night of
 * the last Week of a Season). */
export const PHASE_DURATIONS_MS: Record<GamePhase, number> = {
  flipping: 2_000,
  round_resolved: 3_000,
  night_won: 10_000,
  week_won: 20_000,
  season_won: 30_000,
};

export interface PhaseWindow {
  phase: GamePhase;
  phaseStartedAt: number; // epoch ms
  phaseEndsAt: number; // epoch ms
}
