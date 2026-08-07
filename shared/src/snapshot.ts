import type { GamePhase } from './phase';
import type { ContainerScore, WeekResult } from './scoring';
import type { Flip, NightState, SheetConfig } from './family';

/**
 * The full state broadcast to every client — over WebSocket on every
 * transition, and returned as-is from the REST snapshot endpoint for new
 * or reconnecting viewers. This is the entire sync contract: clients derive
 * all rendering (including "how far into this phase are we") from this
 * object plus their local clock, never from message arrival order/timing.
 */
export interface ChannelSnapshot {
  channelId: string;

  phase: GamePhase;
  phaseStartedAt: number; // epoch ms
  phaseEndsAt: number; // epoch ms

  seasonNumber: number;
  weekNumber: number;
  nightNumber: number;
  /** Denormalized channel config so clients can render "Week 3 of 6" /
   * table-of-weeks layouts without a separate lookup. Static for the life
   * of the channel. */
  nightsPerWeek: number;
  weeksPerSeason: number;
  /** This Season's week-by-week results so far, for the Season Overview
   * screen's tally table. Reset to [] at each new Season. */
  completedWeeks: WeekResult[];

  sheetId: string;
  familyId: string;
  /** Denormalized from the current Sheet so clients can render round/night
   * targets (e.g. "race to 10") without a separate lookup. Static for the
   * life of a Night — only changes when sheetId changes. */
  sheetConfig: SheetConfig;

  /** Family-specific in-progress Night state (round wins, current round's
   * flips, etc.) — the Family engine that owns the current Sheet decides
   * its shape; see NightState in family.ts. */
  nightState: NightState;

  /** The flip currently animating (face withheld until reveal). Null during
   * a round_resolved/night_won/week_won/season_won pause — nothing pending. */
  pendingFlip: Flip | null;

  weekScore: ContainerScore; // points accumulated this week from completed nights
  seasonScore: ContainerScore; // points accumulated this season from completed weeks
  lifetimeRecord: ContainerScore; // seasons won all-time
}
