import type { RecordBreak } from './records';
import type { ContainerScore, SeasonStreak, Side } from './scoring';
import { emptyScore } from './scoring';
import { brinkOf, wonFromBrink } from './drama';

/**
 * What a Season looked like, kept after it closed.
 *
 * The live snapshot is a working set: completedWeeks and completedNights
 * both reset at their container's boundary, which is right for the thing
 * they're for and leaves the coordinator with no memory of any Season but
 * the one running. Fine for rendering a broadcast, and the one real hole
 * under the away digest — crossing a Season boundary turns "the Demons
 * took Season 1,198 from 0-3 down in a Week 7 decider" into "the Demons
 * took Season 1,198", with the entire story gone.
 *
 * So Seasons get written down as they close. Two deliberate limits:
 *
 *  - It is a *ring*, not an archive. HISTORY_LENGTH Seasons, oldest
 *    dropped. The real archive is D1's job and still is; this is the
 *    minimum that closes the digest's hole, and a bounded structure can
 *    live in Durable Object storage without ever needing a sweep.
 *  - It lives under its own storage key and its own endpoint, never on
 *    the snapshot. A snapshot goes out every couple of seconds to every
 *    viewer; this is read once, by the few clients that turn out to need
 *    it. Putting it on the payload would make every broadcast pay for
 *    something almost no broadcast uses.
 *
 * Only the Week order is stored. Final score, who won, whether it went
 * the distance, whether it was a sweep and whether it was a comeback are
 * all derivable from it — see the functions below — and this project's
 * standing rule is to derive rather than persist, because a derived field
 * can be corrected by a deploy and a stored one has to be migrated.
 */
export interface SeasonSummary {
  seasonNumber: number;
  /** Week-by-Week winners in the order they fell. The Season closes the
   * moment someone clinches, so the last entry is always the winner. */
  weeks: Side[];
  /** The Season's own container size. Stored rather than read from the
   * current preset because "went the distance" is a claim about the
   * Season that was played, and a preset can change under it. */
  weeksPerSeason: number;
  /** When the Season closed. The digest doesn't need it — it has its own
   * clock — but a history screen that wants to say "9 November" does. */
  endedAt: number;
  /** The all-time record and the run as they stood once this Season was
   * counted. Two numbers and a pair that make the ring readable on its
   * own, without replaying it from the start. */
  record: ContainerScore;
  streak: SeasonStreak;
  /**
   * All-time records broken by this Season, usually none.
   *
   * Stamped here rather than left in the ledger so the digest gets them
   * for free: it already fetches the ring when an absence crossed a
   * Season boundary, and a record can only break when a Season closes, so
   * the two have exactly the same trigger. Nothing new to fetch and no
   * second window to keep in step with the first.
   *
   * Optional because the ring started filling before records existed —
   * read it through breaksIn().
   */
  records?: RecordBreak[];
}

/** A Season's record breaks, treating a summary written before the ledger
 * existed as having had none. */
export function breaksIn(summary: SeasonSummary): RecordBreak[] {
  return summary.records ?? [];
}

/**
 * How many Seasons the ring keeps.
 *
 * At roughly sixteen Seasons a day on the production preset this is about
 * a day and a half, which covers the absences a digest can still narrate
 * (see narratableSeasons) with a wide margin — past four settled Seasons
 * the digest stops naming them anyway. Sized by what the consumer can use
 * rather than by what storage can hold: at a few hundred bytes a Season
 * the ring could be a hundred times longer at no real cost, and would
 * then be a worse-indexed version of the archive D1 is for.
 */
export const HISTORY_LENGTH = 24;

/** The ring with `summary` added and anything past HISTORY_LENGTH dropped.
 * Pure, so the coordinator's commit path stays a single assignment. */
export function pushSeason(history: SeasonSummary[], summary: SeasonSummary): SeasonSummary[] {
  return [...history, summary].slice(-HISTORY_LENGTH);
}

/** Final Week tally. Counted rather than stored — see SeasonSummary. */
export function seasonScoreOf(summary: SeasonSummary): ContainerScore {
  const score = emptyScore();
  for (const winner of summary.weeks) score[winner] += 1;
  return score;
}

/** Who took it. Always the last Week's winner, because a Season ends on
 * the Week that clinches it and never plays a dead one. */
export function seasonWinnerOf(summary: SeasonSummary): Side | null {
  return summary.weeks.length > 0 ? summary.weeks[summary.weeks.length - 1] : null;
}

/** Whether it ran to its last possible Week. */
export function wentTheDistance(summary: SeasonSummary): boolean {
  return summary.weeks.length >= summary.weeksPerSeason;
}

/** Whether it was taken without dropping a Week. */
export function wasSweep(summary: SeasonSummary): boolean {
  const score = seasonScoreOf(summary);
  return summary.weeks.length > 0 && Math.min(score.humans, score.demons) === 0;
}

/**
 * The side that was a Week from losing it with nothing on the board, and
 * took it anyway.
 *
 * The single most valuable thing the ring buys back, and the thing that
 * made the live predicate's limits obvious: drama.ts asks whether a side
 * has drawn *level* from the brink, because while a Season is running
 * that is the moment it becomes anyone's. Asked of a Season that has
 * finished, that question answers null every time — a side that came back
 * and won isn't level, it's ahead — so until this existed, the best
 * Season the game can produce left no trace the moment a boundary was
 * crossed.
 *
 * Rarer than levelling, and separately weighed for it: 0-3 down and the
 * Season won is once in sixty-four, a quarter of a day's Seasons.
 */
export function seasonWonFromBrink(summary: SeasonSummary): Side | null {
  return wonFromBrink(summary.weeks, brinkOf(summary.weeksPerSeason));
}

/** The Seasons in the ring that settled strictly after `seasonNumber`,
 * oldest first — what a client asks the /recent route for, having been
 * away since then. */
export function seasonsSince(history: SeasonSummary[], seasonNumber: number): SeasonSummary[] {
  return history.filter((summary) => summary.seasonNumber > seasonNumber);
}

/**
 * The Seasons that settled strictly after `after` and no later than
 * `through`, oldest first.
 *
 * Clamped at both ends because the ring and the snapshot are fetched
 * separately and the ring can be a moment newer: a Season that closed
 * between the two reads is in the history and not yet in the record the
 * digest is measuring against. Reporting it would mean a headline from
 * outside the window being described, and would quietly break the
 * accounting that lets copy decide whether it can name every Season (see
 * contextLines) — an off-by-one that would only ever show up on the
 * boundary it was most likely to land on.
 */
export function seasonsBetween(
  history: SeasonSummary[],
  after: number,
  through: number,
): SeasonSummary[] {
  return history.filter(
    (summary) => summary.seasonNumber > after && summary.seasonNumber <= through,
  );
}
