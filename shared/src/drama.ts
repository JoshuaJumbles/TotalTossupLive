import type { GamePhase } from './phase';
import type { ContainerScore, SeasonStreak, Side, WeekResult } from './scoring';
import { isContainerDecided } from './scoring';

/**
 * Which dramatic moments are live right now, and how much they're worth.
 *
 * The point of this module is to let a notification sender spend a small
 * daily budget on the best few moments rather than fire on a set of
 * boolean switches. That matters because the obvious criteria are far more
 * common than they sound: on the main channel a Week sitting 3-3 — the
 * "final tie-breaker 7th Night" — happens roughly every 49 minutes, and a
 * Week match point 128 times a day. Rarity here comes from conjunction
 * and from which container is at stake, not from the predicate itself.
 *
 * Everything is derived from a single snapshot, never from a diff against
 * a previous one. That's deliberate and it's the same principle the rest
 * of the app runs on: a client (or a sender) that has just connected can
 * evaluate the current moment from what it holds, with no history and no
 * memory of message order. The two criteria that genuinely need the past —
 * the comebacks — read it off completedNights/completedWeeks, which the
 * coordinator already records in order.
 */

/**
 * Measured occurrences per day on the main channel's preset (7 Nights per
 * Week, 7 Weeks per Season, the Battle targets), from a 60,000-Season
 * simulation of the real scoring and the real phase durations — about 16
 * Seasons, 93 Weeks and 541 Nights a day.
 *
 * These are rates in *time*, not per opportunity, which is the distinction
 * the budget cares about. Per opportunity a Week decider and a Season
 * decider are exactly equally likely (p = 0.0537 either way — both
 * containers are best-of-7 races on a fair coin, so the symmetry is
 * exact); it's only that Night starts outnumber Week starts 5.8 to 1 that
 * makes one routine and the other worth waking someone for.
 *
 * To add a criterion: measure it, add a row, implement its detection. The
 * weight falls out, and because the sender ranks rather than switches, a
 * new row can't make anyone's phone busier.
 */
export const MOMENT_RATES_PER_DAY = {
  /** A side can close the Week out on the Night now in progress. */
  week_point: 127.56,
  /** The Week is level with one Night left in it — winner takes the Week. */
  week_decider: 29.14,
  /** A side is one Night from winning the Week without conceding one. */
  week_sweep_watch: 22.95,
  /** A side can take the Season this Week. */
  season_point: 22.01,
  /** The Season is level with one Week left in it. */
  season_decider: 5.02,
  /** A side is one Week from a Season without conceding one. */
  season_sweep_watch: 3.99,
  /**
   * A Season streak of 3+ can be extended or ended this Week.
   *
   * Known to be about 23% low: counting this the way notify.ts now
   * identifies one occurrence — once per Week in which the streak is
   * genuinely at stake, so up to three times in a Season where the holder
   * keeps reaching the brink and losing the Week — measures 6.76/day. The
   * number here is left as measured rather than quietly corrected, since
   * the two simulations are counting different things and it's the
   * definition that wants settling, not the digit. Nothing turns on it
   * today: at 5.18 bits this sits below the sender's floor either way.
   */
  streak_on_line: 5.5,
  /** A Week decider inside a Season decider: the Night now in progress
   * takes the whole Season. The best configuration the game can reach. */
  title_night: 1.57,
  /** A side was 0-3 down in Nights this Week and has pulled level. */
  week_comeback: 2.91,
  /** A side was 0-3 down in Weeks this Season and has pulled level. */
  season_comeback: 0.51,
  /** Season 100, 200, 1200... — pure ceremony, and the only criterion
   * that's perfectly predictable in advance. */
  milestone_season: 0.16,
  /**
   * The all-time record is one Season from being drawn level
   * (record_level, which needs a gap of exactly one) or from changing
   * hands (record_lead, which needs it dead level).
   *
   * The two rates here that are estimated rather than simulated, because
   * a single number can't honestly describe them. The lifetime record is
   * a random walk, so it isn't uniformly rare: it clusters into eras when
   * the record happens to be close and is flatly impossible for long
   * stretches when it isn't. The main channel is in one of those eras
   * right now, 594-593 after 1,188 Seasons.
   *
   * Estimated as P(gap is close enough) x the Season-point rate. For a
   * fair walk P(gap = 0) after n Seasons is about 2/sqrt(2*pi*n), so
   * ~2.3% at n = 1,188; against 22 Season points and 5 Season deciders a
   * day that lands near 0.6/day for a lead change and about half that for
   * drawing level, which additionally needs the trailing side to be the
   * one on the brink. Both decay as sqrt(n) — slowly, and in a direction
   * that only makes them rarer, so the weights stay conservative.
   */
  record_level: 0.3,
  record_lead: 0.6,
} as const satisfies Record<string, number>;

export type MomentId = keyof typeof MOMENT_RATES_PER_DAY;

/**
 * The rate a weight of 0 corresponds to — roughly the most frequent thing
 * we would ever consider a moment at all. Fixing it here keeps every
 * weight positive and makes the numbers readable as "bits of rarity":
 * each whole point is one halving of how often this happens.
 *
 * Exported because digest.ts weighs its own retrospective events on the
 * same scale. One reference means a digest headline and a notification
 * are quoted in the same units and can be reasoned about together.
 */
export const RATE_REFERENCE_PER_DAY = 200;

/**
 * Where rarity isn't drama, and the weight has to be overridden by hand.
 *
 * Rarity is a good proxy for how much a moment is worth waking someone
 * for, but only because rare things are usually *surprising* things. A
 * round-numbered Season breaks that: it's the rarest row in the table and
 * also the only one you could have written on a calendar months ago, so
 * ranking it on frequency alone put "Season 1,200 starts now" above "the
 * all-time record can be drawn level after 1,188 Seasons". It's a nice
 * badge, not a reason for a notification.
 *
 * Kept as a separate table rather than by fudging the rate, so the
 * measured numbers stay measured and every departure from them is visible
 * and has to carry a reason.
 */
const MOMENT_WEIGHT_OVERRIDES: Partial<Record<MomentId, number>> = {
  milestone_season: 2,
};

/** A moment's worth, in bits of rarity: each whole point is one halving
 * of how often it happens. Derived from the measured rate rather than
 * authored alongside it, so the two can't drift apart — except where
 * MOMENT_WEIGHT_OVERRIDES says otherwise, with its reasons. */
export function momentWeight(id: MomentId): number {
  return MOMENT_WEIGHT_OVERRIDES[id] ?? Math.log2(RATE_REFERENCE_PER_DAY / MOMENT_RATES_PER_DAY[id]);
}

export interface DramaMoment {
  id: MomentId;
  weight: number;
  /**
   * Who the moment is about: the side that can close something out, whose
   * streak is at stake, or who is mounting the comeback. Null when it's
   * genuinely symmetrical — a decider belongs to neither side.
   *
   * This is what lets the same moment read two ways once there's a
   * favourite team to slant it by: a side pulling level from 0-3 down is
   * a comeback to one viewer and a collapse to the other, off one
   * predicate.
   */
  side: Side | null;
}

export interface DramaReport {
  /** Every live moment, highest weight first. */
  moments: DramaMoment[];
  /**
   * The weight of the rarest live moment — what a sender ranks on.
   *
   * Deliberately the max and not the sum. The criteria overlap by
   * construction (a title_night is also a week_decider and a
   * season_decider; a comeback only exists inside a level container), so
   * adding them up would count the same rarity several times over and
   * reward whichever moment happened to be decomposable into the most
   * pieces. The conjunctions that matter are already measured and named
   * as their own rows, so the max picks them up with their real rate.
   */
  score: number;
}

/** What dramaFor needs. ChannelSnapshot satisfies this structurally, so
 * it can be passed straight in; spelling out the fields instead of naming
 * the snapshot type keeps this module independent of Family state and
 * cheap to test. */
export interface DramaInput {
  phase: GamePhase;
  seasonNumber: number;
  weekNumber: number;
  nightsPerWeek: number;
  weeksPerSeason: number;
  weekScore: ContainerScore;
  seasonScore: ContainerScore;
  /** This Week's Night winners in order; reset each Week. */
  completedNights: Side[];
  /** This Season's Week winners in order; reset each Season. */
  completedWeeks: WeekResult[];
  seasonStreak: SeasonStreak;
  lifetimeRecord: ContainerScore;
}

const SIDES: Side[] = ['humans', 'demons'];

/**
 * How many Seasons a channel has to have behind it before its all-time
 * record counts as a record.
 *
 * A fresh channel starts 0-0, which is dead level, so "whoever takes this
 * Season leads all-time" is true on its very first Week — and meaningless,
 * because there is no history for it to overturn. A judgement call rather
 * than a measured number: the drama in a record moment is the weight of
 * what came before it, and a couple of dozen Seasons is about where that
 * starts to exist. Mostly this protects the debug and battle channels and
 * any channel's first hour; main passed it a thousand Seasons ago.
 */
const RECORD_HISTORY_FLOOR = 25;

/** One short of the majority a size-`n` container needs: a side on this
 * many can take the container at the very next position, and both sides
 * on it means the next position decides it outright. Exported because the
 * copy needs it too — "0-3 down" is only right for a best-of-7. */
export function brinkOf(n: number): number {
  return (n + 1) / 2 - 1;
}

function other(side: Side): Side {
  return side === 'humans' ? 'demons' : 'humans';
}

/**
 * The side that was once `brink` positions down with none of its own, if
 * either was — read off the winners in order, because the scores alone
 * can't tell a 3-3 that was always close from a 3-3 that was 0-3.
 *
 * Returns the side that did the trailing, which is the side mounting the
 * comeback.
 *
 * Exported for digest.ts, which asks the same question of the same array
 * after the fact — whether a comeback came together while a viewer was
 * away. Two copies of this would be two chances to disagree about what a
 * comeback is.
 */
export function cameBackFrom(winners: Side[], brink: number): Side | null {
  // A one-position deficit isn't a comeback. In a best-of-3 container the
  // brink is 1, so every decider is by definition preceded by a 0-1 —
  // without this the criterion would fire on every single decider the
  // debug preset ever reaches and carry no information at all. Observed
  // doing exactly that on the debug channel.
  if (brink < 2) return null;

  const count: ContainerScore = { humans: 0, demons: 0 };
  let trailer: Side | null = null;
  for (const winner of winners) {
    count[winner] += 1;
    for (const side of SIDES) {
      if (count[side] === brink && count[other(side)] === 0) trailer = other(side);
    }
  }
  // Only a comeback once they've actually drawn level again.
  if (trailer && count[trailer] === count[other(trailer)]) return trailer;
  return null;
}

/** Phases where there is something still to play for. The pauses that
 * follow a decided container (week_won, season_won) and standby are
 * excluded: whatever was at stake has just been settled, and reporting it
 * as live would have a sender notifying about a result as though it were
 * a chance. */
const LIVE_PHASES: GamePhase[] = [
  'season_launch',
  'season_overview',
  'flipping',
  'round_resolved',
  'night_won',
];

/**
 * Every dramatic moment live in this snapshot, ranked.
 *
 * Reads purely off the scores and the orders already in the snapshot, so
 * the answer is the same for the web view, the widget, the app and the
 * notification sender — none of them has to agree with the others about
 * what a decider is, because none of them decides.
 */
export function dramaFor(input: DramaInput): DramaReport {
  const moments: DramaMoment[] = [];
  const add = (id: MomentId, side: Side | null) =>
    moments.push({ id, weight: momentWeight(id), side });

  if (!LIVE_PHASES.includes(input.phase)) return { moments: [], score: 0 };

  if (input.phase === 'season_launch') {
    if (input.seasonNumber % 100 === 0) add('milestone_season', null);
    // Nothing else can be at stake before a Season's first flip: both
    // containers are empty by definition.
    return finish(moments);
  }

  const weekBrink = brinkOf(input.nightsPerWeek);
  const seasonBrink = brinkOf(input.weeksPerSeason);

  // A container that's already decided has nothing live in it — the
  // Night in progress is the next one along, or the pause before it.
  const weekLive = !isContainerDecided(input.weekScore, input.nightsPerWeek);
  const seasonLive = !isContainerDecided(input.seasonScore, input.weeksPerSeason);

  const weekDecider =
    weekLive && SIDES.every((side) => input.weekScore[side] === weekBrink);
  const seasonDecider =
    seasonLive && SIDES.every((side) => input.seasonScore[side] === seasonBrink);

  if (weekDecider) {
    add('week_decider', null);
    const back = cameBackFrom(input.completedNights, weekBrink);
    if (back) add('week_comeback', back);
  } else if (weekLive) {
    for (const side of SIDES) {
      if (input.weekScore[side] !== weekBrink) continue;
      add('week_point', side);
      if (input.weekScore[other(side)] === 0) add('week_sweep_watch', side);
    }
  }

  if (seasonDecider) {
    add('season_decider', null);
    const back = cameBackFrom(
      input.completedWeeks.map((week) => week.winner),
      seasonBrink,
    );
    if (back) add('season_comeback', back);
  } else if (seasonLive) {
    for (const side of SIDES) {
      if (input.seasonScore[side] !== seasonBrink) continue;
      add('season_point', side);
      if (input.seasonScore[other(side)] === 0) add('season_sweep_watch', side);
    }
  }

  // The Night in progress takes the Season outright — a Week that has gone
  // the distance inside a Season that has too.
  if (weekDecider && seasonDecider) add('title_night', null);

  // Whichever sides could still take the Season from here. In a decider
  // that's both; otherwise it's whoever is on the brink.
  const contenders = seasonLive
    ? SIDES.filter((side) => input.seasonScore[side] === seasonBrink)
    : [];

  if (contenders.length > 0) {
    const { side: streakSide, length } = input.seasonStreak;
    if (streakSide && length >= 3) add('streak_on_line', streakSide);

    const seasonsBehind = input.lifetimeRecord.humans + input.lifetimeRecord.demons;
    for (const side of seasonsBehind >= RECORD_HISTORY_FLOOR ? contenders : []) {
      const after = { ...input.lifetimeRecord, [side]: input.lifetimeRecord[side] + 1 };
      // "Not ahead" rather than "behind": from a dead-level record a win
      // takes the all-time lead outright, which is at least as big a
      // moment as climbing level from one behind. Already being in front
      // and extending it is just another Season.
      const wasNotAhead = input.lifetimeRecord[side] <= input.lifetimeRecord[other(side)];
      if (after.humans === after.demons) add('record_level', side);
      else if (wasNotAhead && after[side] > after[other(side)]) add('record_lead', side);
    }
  }

  return finish(moments);
}

function finish(moments: DramaMoment[]): DramaReport {
  moments.sort((a, b) => b.weight - a.weight);
  return { moments, score: moments.length > 0 ? moments[0].weight : 0 };
}
