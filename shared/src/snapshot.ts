import type { GamePhase } from './phase';
import type { ContainerScore } from './scoring';
import type { Flip } from './family';

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

  sheetId: string;
  familyId: string;

  /** Family-specific in-progress Night state (round wins, current round's
   * flips, etc.) — opaque here, typed by the Family engine that owns it. */
  nightState: unknown;

  pendingFlip: Flip | null;

  weekScore: ContainerScore; // points accumulated this week from completed nights
  seasonScore: ContainerScore; // points accumulated this season from completed weeks
  lifetimeRecord: ContainerScore; // seasons won all-time
}
