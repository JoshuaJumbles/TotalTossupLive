import type { GamePhase } from './phase';
import type { ContainerScore, SeasonStreak, WeekResult } from './scoring';
import type { Flip, NightState, SheetConfig, SheetStyle } from './family';

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
   * targets (e.g. "race to 10") without a separate lookup. Changes whenever
   * the Night's Sheet does — e.g. per-Night rotation, see presets.ts. */
  sheetConfig: SheetConfig;
  /** Which screen component renders this Sheet — see SheetStyle. */
  sheetStyle: SheetStyle;

  /** Family-specific in-progress Night state (round wins, current round's
   * flips, etc.) — the Family engine that owns the current Sheet decides
   * its shape; see NightState in family.ts. */
  nightState: NightState;

  /** A full shuffled order (0..N-1, N = this Night's targetRoundPoints) per
   * side, decided once when the Night begins and never reshuffled mid-Night
   * — a 'battle'-style Sheet renders "unit i on side X is crossed off" as
   * `unitCrossOrder[X].slice(0, opponent's roundPoints).includes(i)`. Server-
   * generated and persisted (not client-derived) so every viewer sees the
   * same marks and they survive a reconnect — same principle as everything
   * else in ChannelSnapshot. Unused by 'simple'-style Sheets. */
  unitCrossOrder: { humans: number[]; demons: number[] };

  /** The flip currently animating (face withheld until reveal). Null during
   * a round_resolved/night_won/week_won/season_won pause — nothing pending. */
  pendingFlip: Flip | null;

  weekScore: ContainerScore; // points accumulated this week from completed nights
  seasonScore: ContainerScore; // points accumulated this season from completed weeks
  lifetimeRecord: ContainerScore; // seasons won all-time
  /** Consecutive Seasons won by the same side, updated alongside
   * lifetimeRecord at the same moment — see SeasonStreak. */
  seasonStreak: SeasonStreak;
}
