import type { BestOfSheetConfig, GamePhase, Sheet } from '@total-tossup-live/shared';
import { isValidContainerSize, PHASE_DURATIONS_MS } from '@total-tossup-live/shared';

/**
 * Everything that varies per channel: container sizes, the Sheets each
 * Night in a Week rotates through, how long each phase's pause runs, and
 * whether a Season starts itself (autoStart) or waits in the 'standby'
 * phase for a person to click Start. A channel's preset is decided once,
 * by its id, at bootstrap — see presetFor() — and re-derived identically
 * from the snapshot's channelId on every subsequent read, so nothing needs
 * to persist the preset choice itself.
 */
export interface ChannelPreset {
  nightsPerWeek: number;
  weeksPerSeason: number;
  /** Rotated by Night number — see sheetForNight(). A single-entry array
   * (today's behavior) just reuses that one Sheet for every Night. */
  sheets: Sheet[];
  phaseDurationsMs: Record<GamePhase, number>;
  /** true (main only): bootstrap and every completed Season roll straight
   * into the next season_launch, exactly like today. false: land in
   * 'standby' instead — no alarm scheduled, so an idle channel costs
   * nothing — until POST /channels/:id/start. Exists because an
   * always-on, always-fast testing channel is real ongoing Durable
   * Object cost for nobody watching; see the incident that prompted this. */
  autoStart: boolean;
}

/** Which Sheet plays on a given Night — 1-indexed nightNumber, wrapping via
 * modulo so a preset with fewer Sheets than nightsPerWeek just repeats
 * them (e.g. one Sheet defined so far reuses it for every Night, same as
 * before per-Night rotation existed at all). */
export function sheetForNight(preset: ChannelPreset, nightNumber: number): Sheet {
  return preset.sheets[(nightNumber - 1) % preset.sheets.length];
}

const PRODUCTION_SHEET_CONFIG: BestOfSheetConfig = {
  familyId: 'bestof',
  roundSize: 5,
  roundWinThreshold: 3,
  targetRoundPoints: 10,
};

/** The real thing — what totaltossup.live actually plays, running
 * continuously and starting itself. This is the one channel that's
 * *meant* to be always-on. */
export const PRODUCTION_PRESET: ChannelPreset = {
  nightsPerWeek: 6,
  weeksPerSeason: 6,
  sheets: [
    {
      id: 'debug-bestof',
      familyId: 'bestof',
      name: 'Debug: Best of 5',
      style: 'simple',
      config: PRODUCTION_SHEET_CONFIG,
    },
  ],
  phaseDurationsMs: PHASE_DURATIONS_MS,
  autoStart: true,
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
 * in a season" behavior is actually observable, not skipped entirely.
 * Purely about state-machine speed — content-wise it's the same plain
 * debug Sheet as production, just faster. autoStart is false: waits in
 * standby until someone clicks Start, and returns there after each
 * completed season rather than looping forever unattended. */
export const DEBUG_PRESET: ChannelPreset = {
  nightsPerWeek: 2,
  weeksPerSeason: 2,
  sheets: [
    {
      id: 'debug-bestof-fast',
      familyId: 'bestof',
      name: 'Debug: Best of 3 (fast)',
      style: 'simple',
      config: DEBUG_SHEET_CONFIG,
    },
  ],
  phaseDurationsMs: {
    standby: 0,
    season_launch: 3_000,
    season_overview: 2_000,
    flipping: 500,
    round_resolved: 1_000,
    night_won: 1_500,
    week_won: 2_000,
    season_won: 3_000,
  },
  autoStart: false,
};

const BATTLE_NIGHT_1_CONFIG: BestOfSheetConfig = {
  familyId: 'bestof',
  roundSize: 5,
  roundWinThreshold: 3,
  targetRoundPoints: 3, // race to 3 — Night One's target in the escalating 3/5/7/9/11/13 rotation
};

/** The first Battle Sheet — a visual (unit-grid + coin-row) reskin of the
 * exact same bestof mechanics, nothing new engine-side. Only one entry so
 * far; Nights Two through Six (targets 5/7/9/11/13) are a follow-up that's
 * purely more data in this array, once this one's confirmed to feel right. */
export const BATTLE_NIGHT_1_SHEET: Sheet = {
  id: 'battle-night-1',
  familyId: 'bestof',
  name: 'Battle: Night One',
  style: 'battle',
  config: BATTLE_NIGHT_1_CONFIG,
};

/** A preview channel, distinct from "debug": debug is for hammering the
 * state machine fast, battle is for evaluating a new Sheet's visual at a
 * natural, watchable pace — so this reuses real phase durations, not
 * debug's fast ones. autoStart is false for the same reason as debug: a
 * preview channel shouldn't cost anything while nobody's previewing it. */
export const BATTLE_PRESET: ChannelPreset = {
  nightsPerWeek: 2,
  weeksPerSeason: 2,
  sheets: [BATTLE_NIGHT_1_SHEET],
  phaseDurationsMs: PHASE_DURATIONS_MS,
  autoStart: false,
};

// Validated once at module load (effectively "at boot", since this runs on
// first import) rather than per-DO-instance-construction — these are fixed
// constants, not something that varies at runtime.
for (const [name, preset] of Object.entries({ PRODUCTION_PRESET, DEBUG_PRESET, BATTLE_PRESET })) {
  if (!isValidContainerSize(preset.nightsPerWeek) || !isValidContainerSize(preset.weeksPerSeason)) {
    throw new Error(
      `${name} has an invalid container size (nightsPerWeek=${preset.nightsPerWeek}, weeksPerSeason=${preset.weeksPerSeason}) — both must satisfy isValidContainerSize (N mod 4 in {1,2}), see shared/src/scoring.ts`,
    );
  }
}

/**
 * Which preset a channel uses, decided purely by its id. No new persisted
 * state — this is re-derived the same way on every call, so it's always in
 * sync with whatever the current code defines, even for an already-running
 * channel.
 */
export function presetFor(channelId: string): ChannelPreset {
  if (channelId === 'debug') return DEBUG_PRESET;
  if (channelId === 'battle') return BATTLE_PRESET;
  return PRODUCTION_PRESET;
}
