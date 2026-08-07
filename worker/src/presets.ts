import type { BestOfSheetConfig, GamePhase, Sheet } from '@total-tossup-live/shared';
import { isValidContainerSize, PHASE_DURATIONS_MS } from '@total-tossup-live/shared';

/**
 * Everything that varies per channel: container sizes, the Sheet (and its
 * config) each Night plays, and how long each phase's pause runs. A
 * channel's preset is decided once, by its id, at bootstrap — see
 * presetFor() — and re-derived identically from the snapshot's channelId
 * on every subsequent read, so nothing needs to persist the preset choice
 * itself.
 */
export interface ChannelPreset {
  nightsPerWeek: number;
  weeksPerSeason: number;
  sheet: Sheet;
  phaseDurationsMs: Record<GamePhase, number>;
}

const PRODUCTION_SHEET_CONFIG: BestOfSheetConfig = {
  familyId: 'bestof',
  roundSize: 5,
  roundWinThreshold: 3,
  targetRoundPoints: 10,
};

/** The real thing — what totaltossup.live actually plays. */
export const PRODUCTION_PRESET: ChannelPreset = {
  nightsPerWeek: 6,
  weeksPerSeason: 6,
  sheet: {
    id: 'debug-bestof',
    familyId: 'bestof',
    name: 'Debug: Best of 5',
    config: PRODUCTION_SHEET_CONFIG,
  },
  phaseDurationsMs: PHASE_DURATIONS_MS,
};

const DEBUG_SHEET_CONFIG: BestOfSheetConfig = {
  familyId: 'bestof',
  roundSize: 3,
  roundWinThreshold: 2,
  targetRoundPoints: 3,
};

/** Fast enough to watch a full season cycle in well under a minute, while
 * still exercising every phase transition (round_resolved does fire —
 * roundSize > 1 — rather than trivially collapsing every flip into an
 * instant night/week/season win). Nights/weeks per container is 2 rather
 * than 1 specifically so the "multiple nights in a week" / "multiple weeks
 * in a season" behavior is actually observable, not skipped entirely. */
export const DEBUG_PRESET: ChannelPreset = {
  nightsPerWeek: 2,
  weeksPerSeason: 2,
  sheet: {
    id: 'debug-bestof-fast',
    familyId: 'bestof',
    name: 'Debug: Best of 3 (fast)',
    config: DEBUG_SHEET_CONFIG,
  },
  phaseDurationsMs: {
    season_launch: 3_000,
    season_overview: 2_000,
    flipping: 500,
    round_resolved: 1_000,
    night_won: 1_500,
    week_won: 2_000,
    season_won: 3_000,
  },
};

// Validated once at module load (effectively "at boot", since this runs on
// first import) rather than per-DO-instance-construction — these are fixed
// constants, not something that varies at runtime.
for (const [name, preset] of Object.entries({ PRODUCTION_PRESET, DEBUG_PRESET })) {
  if (!isValidContainerSize(preset.nightsPerWeek) || !isValidContainerSize(preset.weeksPerSeason)) {
    throw new Error(
      `${name} has an invalid container size (nightsPerWeek=${preset.nightsPerWeek}, weeksPerSeason=${preset.weeksPerSeason}) — both must satisfy isValidContainerSize (N mod 4 in {1,2}), see shared/src/scoring.ts`,
    );
  }
}

/**
 * Which preset a channel uses, decided purely by its id. A channel named
 * exactly "debug" always gets the fast preset; every other channel
 * (including "main") gets the real one. No new persisted state — this is
 * re-derived the same way on every call, so it's always in sync with
 * whatever the current code defines, even for an already-running channel.
 */
export function presetFor(channelId: string): ChannelPreset {
  return channelId === 'debug' ? DEBUG_PRESET : PRODUCTION_PRESET;
}
