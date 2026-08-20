import type { BarricadeIcon, BestOfSheetConfig, CloudFightIcon, GamePhase, InfernoIcon, RiverSharkIcon, RooftopIcon, Sheet, TeamworkSheetConfig } from '@total-tossup-live/shared';
import { isValidContainerSize, PHASE_DURATIONS_MS } from '@total-tossup-live/shared';
import { BARRICADE_ARRANGEMENT } from './families/barricadeData';
import { CLOUDFIGHT_ARRANGEMENT } from './families/cloudFightData';
import { INFERNO_ARRANGEMENT } from './families/infernoData';
import { ROOFTOP_ARRANGEMENT } from './families/rooftopData';
import { RIVERSHARK_ARRANGEMENT } from './families/riverSharkData';

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

const BATTLE_NIGHT_ORDINALS = ['One', 'Two', 'Three', 'Four', 'Five', 'Six'] as const;

// Escalating race-to targets across the six Battle Nights — same 5-flip,
// first-to-3 round shape throughout. Only the Night target grows, raising
// the stakes/length as the Week goes on. targetRoundPoints just sizes the
// unit grid (unitCrossOrder) — unlike nightsPerWeek/weeksPerSeason it isn't
// a "container" in the tie-proof sense, so it doesn't need
// isValidContainerSize.
const BATTLE_NIGHT_TARGETS = [3, 5, 7, 9, 11, 13] as const;

function battleNightSheet(nightNumber: number, targetRoundPoints: number): Sheet {
  const config: BestOfSheetConfig = { familyId: 'bestof', roundSize: 5, roundWinThreshold: 3, targetRoundPoints };
  return {
    id: `battle-night-${nightNumber}`,
    familyId: 'bestof',
    name: `Battle: Night ${BATTLE_NIGHT_ORDINALS[nightNumber - 1]}`,
    style: 'battle',
    config,
  };
}

/** All six Battle Sheets — a visual (unit-grid + coin-row) reskin of the
 * exact same bestof mechanics, nothing new engine-side. Nights Two through
 * Six reuse Night One's shape (BattleSheet1-6 in Figma), just a bigger
 * target each time. Both PRODUCTION_PRESET and BATTLE_PRESET rotate
 * through these — see each preset's own doc comment for how their use of
 * the rotation differs. */
export const BATTLE_NIGHT_SHEETS: Sheet[] = BATTLE_NIGHT_TARGETS.map((target, i) =>
  battleNightSheet(i + 1, target),
);

/** The real thing — what totaltossup.live actually plays, running
 * continuously and starting itself. This is the one channel that's *meant*
 * to be always-on. Plays the same six Battle Sheets as the `battle`
 * preview channel (Josh's own call, once the Battle visual was sharp
 * enough to be the real thing rather than just a preview of it) — six
 * Nights per Week, six Weeks per Season, so one Season is six full passes
 * through the rotation rather than battle's single preview pass. Running
 * unattended means a streak (or a lifetime record swing) can build up
 * overnight without anyone needing to click Start repeatedly. */
export const PRODUCTION_PRESET: ChannelPreset = {
  nightsPerWeek: 6,
  weeksPerSeason: 6,
  sheets: BATTLE_NIGHT_SHEETS,
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
 * Deliberately kept on the plain 'simple' visual, distinct from
 * PRODUCTION_PRESET/BATTLE_PRESET's Battle Sheets — debug is for hammering
 * the state machine fast, not for evaluating a visual. autoStart is false:
 * waits in standby until someone clicks Start, and returns there after
 * each completed season rather than looping forever unattended. */
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

/** A preview channel, distinct from both debug and (now) production: debug
 * is for hammering the state machine fast, battle is for evaluating a
 * Battle Sheet change at a natural, watchable pace without waiting on a
 * full 6-week Season — so this reuses real phase durations, not debug's
 * fast ones. autoStart is false for the same reason as debug: a preview
 * channel shouldn't cost anything while nobody's previewing it.
 * nightsPerWeek: 6 + weeksPerSeason: 1 (both valid container sizes) means
 * one Season is exactly one full pass through all six Battle Sheets, in
 * order, before returning to standby — a clean, complete preview loop
 * rather than repeating Night One or cutting the rotation short. */
export const BATTLE_PRESET: ChannelPreset = {
  nightsPerWeek: 6,
  weeksPerSeason: 1,
  sheets: BATTLE_NIGHT_SHEETS,
  phaseDurationsMs: PHASE_DURATIONS_MS,
  autoStart: false,
};

/** Barricade — the first Sheet for the Teamwork Family (see
 * families/teamwork.ts for the real win math this config feeds). Style
 * 'barricade' renders two static Figma exports plus the live SymbolGrid/
 * TeamworkBars rather than a unit grid. Demons only have an action track
 * (knife) -- no defense, so their own target is fixed at 5 and never
 * pushed back. Humans have both: medkit as their own fixed action track,
 * planks as their defense track, which is what pushes knife's target out. */
function barricadeSheet(): Sheet {
  const config: TeamworkSheetConfig<BarricadeIcon> = {
    familyId: 'teamwork',
    arrangement: BARRICADE_ARRANGEMENT,
    humans: {
      action: { icons: ['medkit'], target: 6 },
      defense: { icons: ['planks'], target: 5 },
    },
    demons: {
      action: { icons: ['knife'], target: 5 },
    },
  };
  return {
    id: 'barricade-night-one',
    familyId: 'teamwork',
    name: 'Barricade: Night One',
    style: 'barricade',
    config,
  };
}

export const BARRICADE_SHEETS: Sheet[] = [barricadeSheet()];

/** A preview channel for the Teamwork Family, same role BATTLE_PRESET plays
 * for the bestof Family's Battle Sheets — a natural, watchable pace (real
 * phase durations, not debug's fast ones), autoStart false so it costs
 * nothing while nobody's previewing it. Only one Sheet defined so far
 * (Barricade), so sheetForNight() just repeats it every Night — small
 * container sizes since the engine currently closes every Night on its
 * first flip, so there's nothing to gain by making these bigger yet. */
export const TEAMWORK_PRESET: ChannelPreset = {
  nightsPerWeek: 2,
  weeksPerSeason: 1,
  sheets: BARRICADE_SHEETS,
  phaseDurationsMs: {
    standby: 0,
    season_launch: 3_000,
    season_overview: 2_000,
    flipping: PHASE_DURATIONS_MS.flipping,
    round_resolved: PHASE_DURATIONS_MS.round_resolved,
    night_won: PHASE_DURATIONS_MS.night_won,
    week_won: 2_000,
    season_won: 3_000,
  },
  autoStart: false,
};

/** CloudFight — the second Sheet for the Teamwork Family, and the first
 * to actually exercise the generic engine's multi-icon track support:
 * humans' own action track is split across jetpack and bow, sharing one
 * score but drawn on separate lanes (see shared/family.ts's
 * TeamworkTrackMarks doc comment). Humans only have an action track here
 * (roles flipped from Barricade -- no defense, so their own target is
 * fixed at 5 and never pushed back); demons have both, with snake as
 * their fixed action track and skull as their defense track, which is
 * what pushes jetpack/bow's combined target out. Same 5/6/5 targets as
 * Barricade -- confirmed against the real Figma coordinates, not
 * assumed. */
function cloudFightSheet(): Sheet {
  const config: TeamworkSheetConfig<CloudFightIcon> = {
    familyId: 'teamwork',
    arrangement: CLOUDFIGHT_ARRANGEMENT,
    humans: {
      action: { icons: ['jetpack', 'bow'], target: 5 },
    },
    demons: {
      action: { icons: ['snake'], target: 6 },
      defense: { icons: ['skull'], target: 5 },
    },
  };
  return {
    id: 'cloudfight-night-one',
    familyId: 'teamwork',
    name: 'CloudFight: Night One',
    style: 'cloudfight',
    config,
  };
}

export const CLOUDFIGHT_SHEETS: Sheet[] = [cloudFightSheet()];

/** A preview channel for CloudFight, isolated from Barricade's own
 * `teamwork` channel for now -- Josh's own call, while this Sheet is
 * still in development. Once every Teamwork Sheet exists, mixing them
 * into one rotation (a "playlist" pulling randomly from all of them per
 * Week) is the planned follow-up; not built yet. Same shape as
 * TEAMWORK_PRESET otherwise. */
export const CLOUDFIGHT_PRESET: ChannelPreset = {
  nightsPerWeek: 2,
  weeksPerSeason: 1,
  sheets: CLOUDFIGHT_SHEETS,
  phaseDurationsMs: {
    standby: 0,
    season_launch: 3_000,
    season_overview: 2_000,
    flipping: PHASE_DURATIONS_MS.flipping,
    round_resolved: PHASE_DURATIONS_MS.round_resolved,
    night_won: PHASE_DURATIONS_MS.night_won,
    week_won: 2_000,
    season_won: 3_000,
  },
  autoStart: false,
};

/** Inferno — the third Sheet for the Teamwork Family, and a clean reskin
 * of Barricade's exact shape (see families/infernoData.ts's own doc
 * comment for the count confirmation): demons only have an action track
 * (fire), fixed at target 5, never pushed back; humans have both, water
 * as their own fixed action track (target 6) and shield as their defense
 * track (target 5), which is what pushes fire's target out. Same
 * 5/6/5 targets as Barricade -- confirmed against the real Figma bar
 * cell counts (6 water cells, 9 fire cells, 5 shield cells), not
 * assumed. */
function infernoSheet(): Sheet {
  const config: TeamworkSheetConfig<InfernoIcon> = {
    familyId: 'teamwork',
    arrangement: INFERNO_ARRANGEMENT,
    humans: {
      action: { icons: ['water'], target: 6 },
      defense: { icons: ['shield'], target: 5 },
    },
    demons: {
      action: { icons: ['fire'], target: 5 },
    },
  };
  return {
    id: 'inferno-night-one',
    familyId: 'teamwork',
    name: 'Inferno: Night One',
    style: 'inferno',
    config,
  };
}

export const INFERNO_SHEETS: Sheet[] = [infernoSheet()];

/** A preview channel for Inferno, isolated from the other Teamwork
 * channels for now -- same rationale as CLOUDFIGHT_PRESET's own doc
 * comment (a "playlist" mixing every Teamwork Sheet is the planned
 * follow-up once they all exist). Same shape otherwise. */
export const INFERNO_PRESET: ChannelPreset = {
  nightsPerWeek: 2,
  weeksPerSeason: 1,
  sheets: INFERNO_SHEETS,
  phaseDurationsMs: {
    standby: 0,
    season_launch: 3_000,
    season_overview: 2_000,
    flipping: PHASE_DURATIONS_MS.flipping,
    round_resolved: PHASE_DURATIONS_MS.round_resolved,
    night_won: PHASE_DURATIONS_MS.night_won,
    week_won: 2_000,
    season_won: 3_000,
  },
  autoStart: false,
};

/** Rooftop — the fourth Sheet for the Teamwork Family, and the first to
 * exercise the engine's full symmetric shape: both sides have both
 * tracks. Humans' own action is split across spear+guns, sharing one
 * score (the same "handoff" mechanic as CloudFight's jetpack/bow),
 * defended by music; demons' own action is blast, defended by crystal.
 *
 * Both defense tracks carry `pushValue: 0.5` rather than the default 1 --
 * Rooftop's own action:defense icon ratio is 1:1 (unlike every other
 * Sheet's 2:1), so a full-value defense mark would fill too fast
 * relative to its own shorter distance-to-win. Each mark is worth half a
 * "defended point" instead -- two marks build one. Confirmed with Josh:
 * each side's action target is base 5, and can be pushed out to a
 * maximum of 9 (5 + 4, once the opposing defense track is fully built at
 * 8 marks -- floor(8 * 0.5) = 4). Each defense track's own target is 4
 * (the "possible defense value" -- 2 marks per point x 4 points = 8
 * marks to fully build), but wins outright one mark past that, at 9 --
 * see TeamworkTrackConfig's own doc comment and teamwork.ts's
 * `defenseWinMarks()` for the "wins when it exceeds the target" math
 * this drives. Both numbers hand-verified against Josh's own worked
 * example before writing any code. */
function rooftopSheet(): Sheet {
  const config: TeamworkSheetConfig<RooftopIcon> = {
    familyId: 'teamwork',
    arrangement: ROOFTOP_ARRANGEMENT,
    humans: {
      action: { icons: ['spear', 'guns'], target: 5 },
      defense: { icons: ['music'], target: 4, pushValue: 0.5 },
    },
    demons: {
      action: { icons: ['blast'], target: 5 },
      defense: { icons: ['crystal'], target: 4, pushValue: 0.5 },
    },
  };
  return {
    id: 'rooftop-night-one',
    familyId: 'teamwork',
    name: 'Rooftop: Night One',
    style: 'rooftop',
    config,
  };
}

export const ROOFTOP_SHEETS: Sheet[] = [rooftopSheet()];

/** A preview channel for Rooftop, isolated from the other Teamwork
 * channels for now -- same rationale as CLOUDFIGHT_PRESET/
 * INFERNO_PRESET's own doc comments. Same shape otherwise. */
export const ROOFTOP_PRESET: ChannelPreset = {
  nightsPerWeek: 2,
  weeksPerSeason: 1,
  sheets: ROOFTOP_SHEETS,
  phaseDurationsMs: {
    standby: 0,
    season_launch: 3_000,
    season_overview: 2_000,
    flipping: PHASE_DURATIONS_MS.flipping,
    round_resolved: PHASE_DURATIONS_MS.round_resolved,
    night_won: PHASE_DURATIONS_MS.night_won,
    week_won: 2_000,
    season_won: 3_000,
  },
  autoStart: false,
};

/** RiverShark — the fifth Sheet for the Teamwork Family, another clean
 * reskin of Barricade's exact asymmetric shape (see riverSharkData.ts's
 * own doc comment for the count confirmation): demons only have an
 * action track (shark, target 5, no defense); humans have both, gun as
 * their own fixed action track (target 6) and oar as their defense track
 * (target 5), which pushes shark's target out. Same 5/6/5 targets as
 * Barricade/Inferno -- confirmed against the real Figma bar cell counts
 * (6 gun cells, 9 shark cells, 5 oar cells), not assumed. */
function riverSharkSheet(): Sheet {
  const config: TeamworkSheetConfig<RiverSharkIcon> = {
    familyId: 'teamwork',
    arrangement: RIVERSHARK_ARRANGEMENT,
    humans: {
      action: { icons: ['gun'], target: 6 },
      defense: { icons: ['oar'], target: 5 },
    },
    demons: {
      action: { icons: ['shark'], target: 5 },
    },
  };
  return {
    id: 'rivershark-night-one',
    familyId: 'teamwork',
    name: 'RiverShark: Night One',
    style: 'rivershark',
    config,
  };
}

export const RIVERSHARK_SHEETS: Sheet[] = [riverSharkSheet()];

/** A preview channel for RiverShark, isolated from the other Teamwork
 * channels for now -- same rationale as the other preview presets' own
 * doc comments. Same shape otherwise. */
export const RIVERSHARK_PRESET: ChannelPreset = {
  nightsPerWeek: 2,
  weeksPerSeason: 1,
  sheets: RIVERSHARK_SHEETS,
  phaseDurationsMs: {
    standby: 0,
    season_launch: 3_000,
    season_overview: 2_000,
    flipping: PHASE_DURATIONS_MS.flipping,
    round_resolved: PHASE_DURATIONS_MS.round_resolved,
    night_won: PHASE_DURATIONS_MS.night_won,
    week_won: 2_000,
    season_won: 3_000,
  },
  autoStart: false,
};

// Validated once at module load (effectively "at boot", since this runs on
// first import) rather than per-DO-instance-construction — these are fixed
// constants, not something that varies at runtime.
for (const [name, preset] of Object.entries({
  PRODUCTION_PRESET,
  DEBUG_PRESET,
  BATTLE_PRESET,
  TEAMWORK_PRESET,
  CLOUDFIGHT_PRESET,
  INFERNO_PRESET,
  ROOFTOP_PRESET,
  RIVERSHARK_PRESET,
})) {
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
  if (channelId === 'teamwork') return TEAMWORK_PRESET;
  if (channelId === 'cloudfight') return CLOUDFIGHT_PRESET;
  if (channelId === 'inferno') return INFERNO_PRESET;
  if (channelId === 'rooftop') return ROOFTOP_PRESET;
  if (channelId === 'rivershark') return RIVERSHARK_PRESET;
  return PRODUCTION_PRESET;
}
