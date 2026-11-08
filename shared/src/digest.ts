import { RATE_REFERENCE_PER_DAY, brinkOf, cameBackFrom } from './drama';
import type { SeasonSummary } from './history';
import { seasonsBetween, seasonWinnerOf, seasonWonFromBrink, wasSweep } from './history';
import type { ContainerScore, SeasonStreak, Side, WeekResult } from './scoring';

/**
 * What happened while you were away.
 *
 * The same criteria the notification sender ranks, read backwards. A
 * notification is prospective, rate-limited and pushed — "this is about to
 * happen". A digest is retrospective, volume-limited and pulled — "this
 * happened". One set of ideas about what matters, two governors.
 *
 * Three things make this a different problem than notify.ts, though, and
 * all three come from the same place: a digest is a function of an
 * interval, where everything else here is a function of a snapshot.
 *
 * It needs no history to be one. The client already holds the last
 * snapshot it saw, and the difference between two snapshots carries more
 * than it looks: the all-time record says how many Seasons each side took
 * and whether it changed hands, the streak says whether a run ended,
 * completedWeeks gives the current Season's Weeks in order. So a digest of
 * a bounded absence is mostly a diff and not a log, which is why this
 * ships with no D1 and no new server state. See DIFF_BLIND_SPOTS for what
 * that costs.
 *
 * It has to know how long you were gone. "A 5-Season run ended" is a
 * headline if you went for coffee and noise if you've been away a week, by
 * which time fourteen runs have ended. That isn't a question of how rare
 * the event is — it's rare either way — so the absence can't be folded
 * into the weight. It gets its own gate, see EXPECTED_COUNT_CEILING.
 *
 * And it can decline to exist. An absence where nothing cleared the bar
 * returns null rather than an empty shell, because a digest that reliably
 * says "nothing much happened" trains you to stop reading it.
 */

/**
 * Occurrences per day on the main channel's preset, for the events a
 * digest can report after the fact. Same units and same reference as
 * MOMENT_RATES_PER_DAY, so a headline and a notification are quoted on one
 * scale.
 *
 * The three streak rows are derived rather than simulated, and they're the
 * one place in this project where that's the stronger claim. A Season on
 * the main preset is a best-of-7 of best-of-7s of fair coins resolved by a
 * symmetric engine, so each side takes it with probability exactly a half
 * and Seasons are independent — which makes runs a plain Bernoulli run
 * process. At 16 Seasons a day that's 8 runs a day; a quarter of them
 * reach three; and the expected number of Seasons a run spends beyond its
 * third is also a quarter. So reaching three, ending at three or more, and
 * getting longer than three all happen 2.0 times a day, exactly. Confirmed
 * against 20 million simulated Seasons, which agreed to three decimals.
 *
 * That identity has a consequence worth stating: rarity cannot tell
 * "their run is over" from "they won another one". See the overrides.
 *
 * The record pair are inherited estimates and can't be anything else — how
 * close the all-time record happens to be is a random walk, so there is no
 * stationary rate to measure. Taken as the matching prospective moment
 * from MOMENT_RATES_PER_DAY resolving in the relevant direction, which is
 * about half the time.
 *
 * `season_comeback` is the same event drama.ts already measured, read
 * after the fact instead of before, so it carries the same rate.
 *
 * `season_run` is deliberately absent. Every row here is a rate in time,
 * but one side taking most of the Seasons is a property of the window
 * itself and has no per-day frequency — it's weighed from its own
 * improbability instead. See runWeight().
 */
export const DIGEST_RATES_PER_DAY = {
  /** The side leading all-time changed, or took the lead from level. */
  record_changed_hands: 0.3,
  /** The all-time record was drawn level. */
  record_drawn_level: 0.15,
  /**
   * A side pulled the Season *level* from the brink with none of its own —
   * a situation, read off the Season still being played.
   *
   * Carried over from drama.ts as a measured estimate and now derived
   * exactly, like the rows below it: 0-3 down is a quarter of Seasons and
   * three straight back is an eighth of those, so one in thirty-two, so
   * 0.5 a day. The 0.51 it was authored at was the simulation's noise.
   */
  season_comeback: 0.5,
  /**
   * A side was a Week from losing the Season with nothing on the board and
   * took it anyway — a result, read off a Season that has closed.
   *
   * Not the same event as the row above seen later, which is the mistake
   * this nearly was: 0-3 down happens in a quarter of Seasons, levelling
   * in a third of those, and winning from level in half again, so one is
   * 0.5 a day and the other 0.25. That makes this the heaviest headline in
   * the table at 9.64 bits, ahead even of the all-time lead changing —
   * correctly, since it is the best single thing the game produces and it
   * happens about once every four days.
   */
  season_won_from_brink: 0.25,
  /** A run of 3+ Seasons ended. */
  streak_broken: 2.0,
  /** A run reached 3 Seasons. */
  streak_started: 2.0,
  /** A run already at 3+ got longer. Exactly as frequent as the two
   * above — see the overrides for why it still isn't a headline. */
  streak_extended: 2.0,
  /** A Season was taken without dropping a Week. Derived, not simulated,
   * and on the same footing as the streak rows: a sweep is four fair Weeks
   * one way, so an eighth of Seasons, so 2.0 a day. */
  season_swept: 2.0,
  /** A round-numbered Season went by. */
  milestone_passed: 0.16,
} as const satisfies Record<string, number>;

export type HeadlineId = keyof typeof DIGEST_RATES_PER_DAY | 'season_run';

/**
 * Where rarity isn't interest — the third time this project has had to
 * write that down, and the clearest case of it yet.
 *
 * A round-numbered Season is the rarest row in the table and the only one
 * you could have put in a diary a month ago. Same as drama.ts's own
 * milestone override, same reasoning: predictable isn't surprising.
 *
 * An extended run is the interesting one. It is exactly as rare as a
 * broken run — provably, not approximately: both are 2.0 a day, because
 * the number of runs reaching three and the expected Seasons spent beyond
 * three are the same quarter. So the rarity measure, which carries every
 * other decision in this module, is flatly unable to separate "the Humans'
 * 6-Season run is over" from "the Humans made it 7". One is a state
 * change; the other is the absence of one. A reader who came back to find
 * things exactly as they left them, only more so, has not missed news.
 *
 * That's a judgement, so it's recorded as a judgement rather than smuggled
 * into the rate. The exact value doesn't matter — anything under the floor
 * has the same effect — 5 just keeps it legibly a notch down rather than
 * flattened in with the furniture.
 */
const HEADLINE_WEIGHT_OVERRIDES: Partial<Record<HeadlineId, number>> = {
  milestone_passed: 2,
  streak_extended: 5,
};

/** A headline's worth, in the same bits of rarity the sender uses. */
export function headlineWeight(id: Exclude<HeadlineId, 'season_run'>): number {
  return (
    HEADLINE_WEIGHT_OVERRIDES[id] ??
    Math.log2(RATE_REFERENCE_PER_DAY / DIGEST_RATES_PER_DAY[id])
  );
}

/**
 * How improbable it is that one side took `to` of `settled` Seasons, in
 * bits — the two-tailed binomial tail against a fair coin.
 *
 * This is the one headline whose weight can't come from a rate, because
 * "one side dominated" isn't an event that happens at a frequency; it's a
 * shape the window either has or hasn't. Bits of surprise rather than bits
 * of rarity-in-time, which are not the same measurement — but they are the
 * same intuition in the same units, and ranking only needs them roughly
 * commensurable.
 *
 * It's also the only headline that survives a long absence, which is the
 * point of having it: after a week away nothing else is news, but
 * "the Demons took 70 of the 112 Seasons you missed" still is.
 */
export function runWeight(settled: number, to: number): number {
  if (settled < 3) return 0;
  const lead = Math.max(to, settled - to);
  // P(at least `lead` of `settled` to one side or the other).
  let tail = 0;
  for (let k = lead; k <= settled; k += 1) tail += binomial(settled, k);
  const p = Math.min(1, (2 * tail) / Math.pow(2, settled));
  return p <= 0 ? 0 : -Math.log2(p);
}

function binomial(n: number, k: number): number {
  let result = 1;
  for (let i = 1; i <= k; i += 1) result = (result * (n - k + i)) / i;
  return result;
}

export interface DigestPolicy {
  /** How many headlines a digest shows at most. A digest is read in one
   * glance, so this is a volume limit and not a rate limit — the sender's
   * problem was how often, this one's is how much. */
  maxHeadlines: number;
  /**
   * The weight below which something is context rather than a headline.
   *
   * The same 6.5 bits the sender spends its budget above, which is not a
   * coincidence worth hiding: "worth waking you for" and "worth telling
   * you when you get back" turn out to be close to the same bar.
   *
   * What it separates, now that there are enough criteria to see it: a
   * comeback (8.61) and a record change (9.38) lead comfortably; a broken
   * run (6.64) and a swept Season (6.64) clear it; a Season going the
   * distance (5.32) does not, and is context instead. That last one is
   * worth stating plainly because it reads as a miss — a Week 7 decider is
   * the best thing the game produces — but it happens five times a day,
   * and a headline that fires five times a day is furniture. The judgement
   * calls (an extended run, a milestone) sit under the floor by override
   * rather than by rate.
   */
  weightFloor: number;
  /**
   * How many occurrences of an event you'd have to expect in the absence
   * before it stops being news.
   *
   * This is the gate the weight can't be: a run ending is exactly as rare
   * whether you were gone two hours or two weeks, but in two weeks you'd
   * expect twenty-eight of them and reporting one as a headline would be
   * absurd. Expected count is rate x days away, so this demotes an event
   * to context precisely when the absence got long enough to make it
   * ordinary.
   *
   * It would have been tidier to fold the absence into the weight —
   * weight by -log2(rate x days) and let one number do both jobs. That's
   * wrong, and wrong in an instructive way: it conflates surprise with
   * interest. By that measure a run ending inside a two-hour absence
   * scores 2.3 bits and wouldn't headline at all, because you half expect
   * it. But it's still the most interesting thing that happened. Rarity
   * ranks; expectation gates; neither does the other's job.
   */
  expectedCountCeiling: number;
  /** Beyond this many Seasons settled, the context stops naming them
   * individually and starts counting them. */
  narratableSeasons: number;
}

export const DEFAULT_DIGEST_POLICY: DigestPolicy = {
  maxHeadlines: 3,
  weightFloor: 6.5,
  expectedCountCeiling: 1,
  narratableSeasons: 4,
};

/**
 * What a diff still can't see, kept here so the gaps are a known cost
 * rather than a surprise.
 *
 * - A past Week's internal shape. completedNights resets every Week, so
 *   only the Week in progress can be told as a story. The Season ring
 *   deliberately doesn't fix this: a Season's worth of Night orders is
 *   twenty times the data for the one Week in it anybody asked about.
 * - Anything that undid itself. A record that went level, changed hands
 *   and came back level while you were out reads as no change at all.
 *   The ring narrows this to the record specifically — Season outcomes
 *   are now read from history rather than inferred from two endpoints —
 *   but the all-time tally is still only ever sampled twice.
 * - How many times something happened, beyond the ring's length or
 *   without it. The diff sees a streak at 1 that was 5 and can't say
 *   whether one run ended or three did, which is exactly why
 *   expectedCountCeiling works off elapsed time instead of a count.
 *
 * Closed by the Season ring, left named so the shape of the fix is on the
 * record: a Season that went the distance, was swept, or was taken from
 * the brink used to vanish the moment a boundary was crossed, because
 * completedWeeks resets. They are now read from history.ts instead of
 * guessed from two endpoints.
 */
export const DIFF_BLIND_SPOTS = ['past_week_shape', 'changes_that_reverted', 'occurrence_counts'] as const;

/**
 * The fields a digest reads, plus when they were read. ChannelSnapshot
 * satisfies everything but `seenAt`, so a client stores
 * `{ ...snapshot, seenAt: Date.now() }` and passes the same shape back.
 */
export interface DigestPoint {
  seenAt: number;
  seasonNumber: number;
  weekNumber: number;
  nightsPerWeek: number;
  weeksPerSeason: number;
  weekScore: ContainerScore;
  seasonScore: ContainerScore;
  completedWeeks: WeekResult[];
  lifetimeRecord: ContainerScore;
  seasonStreak: SeasonStreak;
}

export interface DigestHeadline {
  id: HeadlineId;
  weight: number;
  /** Who it's about, or null when it belongs to neither side. The hook for
   * reading a digest from the viewer's own side once hope points exist —
   * the same predicate is a comeback to one and a collapse to the other. */
  side: Side | null;
}

/** Everything a digest states regardless of what it leads with: how long,
 * what settled, where things stand. Never ranked and never gated, because
 * none of it is competing to be the headline. */
export interface DigestContext {
  awayMs: number;
  /** Seasons settled while away, and how they split. */
  seasonsSettled: number;
  seasonsBy: ContainerScore;
  /** Weeks settled within the Season now running. Reset at a boundary, so
   * this counts the current Season only. */
  weeksThisSeason: number;
  record: ContainerScore;
  recordWas: ContainerScore;
  streak: SeasonStreak;
  /** The run as it stood before the absence — the only place the length a
   * broken run *reached* still exists, since the live streak has already
   * reset to the new holder. "Their 5-Season run is over" needs it. */
  streakWas: SeasonStreak;
  /**
   * The number of the most recently settled Season.
   *
   * Not `seasonNumber - 1`, which is wrong for thirty seconds every
   * Season: resolveFlip credits the all-time record the moment a Season
   * closes but beginNextStep doesn't advance the counter until the pause
   * ends, so during season_won the record is one ahead of the number. The
   * same skew the sender's occurrence keys had to work around.
   *
   * Counted off the record instead, which can't skew: a channel opens on
   * Season 1 with a 0-0 record, so Seasons-ever-settled and the number of
   * the last one to settle are the same figure.
   */
  lastSettledSeason: number;
  seasonNumber: number;
  weekNumber: number;
  seasonScore: ContainerScore;
  weekScore: ContainerScore;
  /**
   * The Seasons that settled during the absence, oldest first, as far as
   * the ring could say — empty when no history was supplied, when the
   * absence crossed no boundary, or when it was long enough to run off
   * the end of the ring.
   *
   * Always a subset of what seasonsSettled counts, never a replacement
   * for it: the count comes off the all-time record and is exact at any
   * absence length, while this is the detail behind as many of those
   * Seasons as were still being kept. Copy that needs a number uses the
   * count; copy that wants to describe a Season uses these.
   */
  seasons: SeasonSummary[];
}

export interface Digest {
  headlines: DigestHeadline[];
  context: DigestContext;
  /**
   * 'narrated' when the absence is short enough to talk about the Seasons
   * in it; 'summarised' when there were too many and the honest thing is
   * counts and a record delta. A long absence usually produces no
   * headlines at all — everything is expected by then — and a summarised
   * digest is what's left to say rather than nothing.
   */
  register: 'narrated' | 'summarised';
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** Below this a run isn't a run — matches drama.ts's own streak threshold. */
const NOTABLE_STREAK = 3;

function leaderOf(score: ContainerScore): Side | null {
  if (score.humans === score.demons) return null;
  return score.humans > score.demons ? 'humans' : 'demons';
}

/**
 * The digest for an absence, or null if there isn't one worth showing.
 *
 * Null is the common answer and the important one. Most returns to the app
 * are quick, nothing has closed, and the live view already says everything
 * a digest would. Showing a card to say so would be worse than showing
 * nothing.
 */
export function digestBetween(
  then: DigestPoint,
  now: DigestPoint,
  /**
   * The Season ring from /recent, if the caller fetched it. Optional, and
   * the digest is correct without it — every criterion that reads it is
   * one that was simply invisible before, never one that changes answer.
   * A client that can't reach the endpoint, or hasn't been away long
   * enough to need it, passes nothing and loses nothing it had.
   */
  seasons: SeasonSummary[] = [],
  policy: Partial<DigestPolicy> = {},
): Digest | null {
  const { maxHeadlines, weightFloor, expectedCountCeiling, narratableSeasons } = {
    ...DEFAULT_DIGEST_POLICY,
    ...policy,
  };

  const awayMs = Math.max(0, now.seenAt - then.seenAt);
  const awayDays = awayMs / DAY_MS;

  const seasonsBy: ContainerScore = {
    humans: Math.max(0, now.lifetimeRecord.humans - then.lifetimeRecord.humans),
    demons: Math.max(0, now.lifetimeRecord.demons - then.lifetimeRecord.demons),
  };
  const seasonsSettled = seasonsBy.humans + seasonsBy.demons;

  // Which of the ring's Seasons fall inside the absence. Both bounds come
  // off the all-time record rather than off seasonNumber, for the same
  // reason lastSettledSeason does — the counter lags the record by one for
  // the length of a season_won pause, and a point captured in that window
  // would otherwise re-report the Season the viewer watched finish.
  const settledWhileAway = seasonsBetween(
    seasons,
    then.lifetimeRecord.humans + then.lifetimeRecord.demons,
    now.lifetimeRecord.humans + now.lifetimeRecord.demons,
  );

  const context: DigestContext = {
    awayMs,
    seasonsSettled,
    seasonsBy,
    weeksThisSeason: now.completedWeeks.length,
    record: now.lifetimeRecord,
    recordWas: then.lifetimeRecord,
    streak: now.seasonStreak,
    streakWas: then.seasonStreak,
    lastSettledSeason: now.lifetimeRecord.humans + now.lifetimeRecord.demons,
    seasonNumber: now.seasonNumber,
    weekNumber: now.weekNumber,
    seasonScore: now.seasonScore,
    weekScore: now.weekScore,
    seasons: settledWhileAway,
  };

  const candidates: DigestHeadline[] = [];
  const add = (id: Exclude<HeadlineId, 'season_run'>, side: Side | null) => {
    // Rarity ranks, expectation gates — see DigestPolicy. An event you'd
    // expect more than once in an absence this long isn't news about it.
    if (DIGEST_RATES_PER_DAY[id] * awayDays > expectedCountCeiling) return;
    candidates.push({ id, weight: headlineWeight(id), side });
  };

  // The record. The heaviest thing a diff can see, and the only one it can
  // see at any absence length, because it's a running total rather than a
  // thing that resets.
  if (seasonsSettled > 0) {
    const wasLevel = then.lifetimeRecord.humans === then.lifetimeRecord.demons;
    const isLevel = now.lifetimeRecord.humans === now.lifetimeRecord.demons;
    const leadThen = leaderOf(then.lifetimeRecord);
    const leadNow = leaderOf(now.lifetimeRecord);
    if (isLevel && !wasLevel) add('record_drawn_level', null);
    else if (leadNow && leadNow !== leadThen) add('record_changed_hands', leadNow);
  }

  // The streak. Reported from where it ended up, since the diff can't see
  // the shape of the journey.
  //
  // A shorter run on the *same* side counts as broken too, which isn't
  // obvious and is the one thing live data caught straight away: the
  // Demons were on five and are now on one, so the run plainly ended and
  // they started another. Checking only whether the side changed misses
  // every break a side goes on to follow with a fresh win — which, since
  // runs end by definition when the other side wins and the absence can
  // easily contain both, is most of them.
  const runThen = then.seasonStreak;
  const runNow = now.seasonStreak;
  const runEnded =
    runThen.side !== null &&
    runThen.length >= NOTABLE_STREAK &&
    (runNow.side !== runThen.side || runNow.length < runThen.length);
  if (runEnded) {
    add('streak_broken', runThen.side);
  } else if (runNow.side && runNow.length >= NOTABLE_STREAK) {
    if (runThen.side !== runNow.side || runThen.length < NOTABLE_STREAK) {
      add('streak_started', runNow.side);
    } else if (runNow.length > runThen.length) {
      add('streak_extended', runNow.side);
    }
  }

  // A comeback that came together while away: the Season is level from the
  // brink now and wasn't then. Same predicate the sender uses, asked of the
  // same ordered array after the fact rather than before — and still only
  // ever about the Season being played, because levelling is a situation
  // and a Season that has closed no longer has one.
  const seasonBrink = brinkOf(now.weeksPerSeason);
  const winnersOf = (point: DigestPoint) => point.completedWeeks.map((week) => week.winner);
  if (now.seasonNumber === then.seasonNumber) {
    const back = cameBackFrom(winnersOf(now), seasonBrink);
    if (back && !cameBackFrom(winnersOf(then), seasonBrink)) add('season_comeback', back);
  } else {
    const back = cameBackFrom(winnersOf(now), seasonBrink);
    if (back) add('season_comeback', back);
  }

  // What the ring is for. Both of these are properties of a Season that
  // has finished, so neither was visible at all before history existed:
  // the all-time record says who took a Season and nothing whatever about
  // how it went.
  //
  // One headline each however many Seasons qualified, because a headline
  // says what happened and not how often; the most recent wins by falling
  // last.
  const fromBrink = settledWhileAway.map(seasonWonFromBrink).filter((side): side is Side => side !== null);
  if (fromBrink.length > 0) add('season_won_from_brink', fromBrink[fromBrink.length - 1]);

  const swept = settledWhileAway.filter(wasSweep);
  if (swept.length > 0) add('season_swept', seasonWinnerOf(swept[swept.length - 1]));

  // Ceremony, demoted below the floor by the override — present so the
  // context can mention it, never able to lead.
  if (Math.floor(now.seasonNumber / 100) > Math.floor(then.seasonNumber / 100)) {
    add('milestone_passed', null);
  }

  // One side taking most of what you missed. Weighed from its own
  // improbability, so unlike everything above it gets *more* reportable as
  // the absence grows, not less.
  if (seasonsSettled >= 3) {
    const ahead = seasonsBy.humans >= seasonsBy.demons ? 'humans' : 'demons';
    const weight = runWeight(seasonsSettled, seasonsBy[ahead]);
    if (weight >= weightFloor) candidates.push({ id: 'season_run', weight, side: ahead });
  }

  const headlines = candidates
    .filter((headline) => headline.weight >= weightFloor)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, maxHeadlines);

  const register = seasonsSettled > narratableSeasons ? 'summarised' : 'narrated';

  // Nothing cleared the bar. A long absence still has something true and
  // worth saying — how much went by — so it gets a summary with no
  // headlines; a short one gets no digest at all.
  if (headlines.length === 0 && register === 'narrated') return null;

  return { headlines, context, register };
}

/** Who is in front, or null if level. Exported for copy and for the card. */
export function digestLeader(score: ContainerScore): Side | null {
  return leaderOf(score);
}
