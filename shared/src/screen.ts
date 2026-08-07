import type { GamePhase } from './phase';

/**
 * Which screen a phase belongs to. A pure lookup, not a separate authority —
 * the server's phase clock is still the only thing deciding when anything
 * changes; this just groups phases into the four screens design settled on.
 * week_won stays grouped with the gameplay loop (an in-place beat on Night
 * Sheet) rather than getting its own screen — Season Overview is what
 * carries the "you won the Week" news forward.
 */
export type ScreenId = 'season_launch' | 'season_overview' | 'night_sheet' | 'season_finish';

const PHASE_TO_SCREEN: Record<GamePhase, ScreenId> = {
  season_launch: 'season_launch',
  season_overview: 'season_overview',
  flipping: 'night_sheet',
  round_resolved: 'night_sheet',
  night_won: 'night_sheet',
  week_won: 'night_sheet',
  season_won: 'season_finish',
};

export function screenForPhase(phase: GamePhase): ScreenId {
  return PHASE_TO_SCREEN[phase];
}
