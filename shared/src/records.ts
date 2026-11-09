import type { ContainerScore, SeasonStreak, Side } from './scoring';

/**
 * All-time records: the biggest number each side has ever reached, and
 * when they reached it.
 *
 * The thing that makes this module unlike every other criterion here is
 * that **it needs no authored rate**. Everywhere else — drama.ts,
 * notify.ts, digest.ts — something had to be simulated or derived to say
 * how often an event happens, and the weight came out of that. A record
 * weighs itself: after n observations, the chance the next one is a new
 * maximum is about 1/n, so a mark breaking is worth log2(how long the old
 * mark stood). A mark that stood four hundred Seasons is 8.6 bits and
 * leads a digest; one set five Seasons ago is 2.3 bits and stays quiet.
 * No table, no simulation, nothing to keep in step with the preset.
 *
 * That same property solves the cold start, which is otherwise the hard
 * part of shipping a ledger into a channel that has already played twelve
 * hundred Seasons. For the first few days every value is a record and
 * every break scores a bit or two — correctly, because nothing has been
 * beaten yet — so the ledger is silent until it has earned the right to
 * speak. There is no bootstrap period to special-case.
 *
 * ## What qualifies as a record
 *
 * A record is only worth keeping if **its support is unbounded**. This is
 * the bounded-container problem this project keeps meeting, in its purest
 * form: "biggest margin in a Season" sounds like a record and isn't,
 * because a best-of-7 caps at 4-0, which happens twice a day, so the mark
 * is set within hours and can never move again. A record that saturates
 * is a constant with a date on it.
 *
 * The three kept here are all unbounded, and all three are readable off
 * state the coordinator already has at the moment a Season closes:
 *
 *  - `season_run`  — longest run of consecutive Seasons (from seasonStreak)
 *  - `lead`        — biggest all-time lead ever held (from lifetimeRecord)
 *  - `reign`       — most consecutive Seasons holding the all-time lead
 *
 * Deliberately not here yet: the longest run of consecutive *Weeks*,
 * which is unbounded and a good record, but is the only candidate that
 * needs new live state (a Week streak that survives a Season boundary,
 * and its peak within a Season). It belongs with the live "their Week run
 * is on the line" criterion that same state unlocks, not with this.
 *
 * Also deliberately absent: a side's longest drought. It looks like a
 * fourth record and is arithmetically the third — a Humans drought is
 * exactly a Demons run — so it is the same number with a better sentence
 * attached, and belongs in copy rather than in the ledger.
 */

export type RecordId = 'season_run' | 'lead' | 'reign';

export const RECORD_IDS: RecordId[] = ['season_run', 'lead', 'reign'];

export interface RecordMark {
  value: number;
  /** The Season it was set in. Also what dates it: Season numbers are
   * dense and monotonic, so this is a position in the channel's history
   * as well as the age the weight is computed from. */
  seasonNumber: number;
  at: number;
}

export interface SideMarks {
  humans: RecordMark | null;
  demons: RecordMark | null;
}

export interface RecordLedger {
  /**
   * Where the ledger's claims begin.
   *
   * Load-bearing, and the honest part. This shipped into a channel on its
   * twelve-hundredth Season, and nothing can recover what the biggest lead
   * was across the first twelve hundred — the coordinator never kept it.
   * So "all-time" here means "since this Season", the marks say so, and
   * copy can decide how loudly to admit it. It is also what the very first
   * break of each record is weighed against, since there is no previous
   * mark to measure the age from.
   */
  since: { seasonNumber: number; at: number };
  marks: Record<RecordId, SideMarks>;
  /**
   * Who currently holds the all-time lead and the Season their reign
   * began — bookkeeping for the `reign` record, kept here rather than on
   * the snapshot because it is nobody else's business and would otherwise
   * be two more numbers on every broadcast.
   */
  reign: { side: Side | null; since: number };
}

export interface RecordBreak {
  id: RecordId;
  side: Side;
  value: number;
  /** The mark it beat, or null when this record had never been set. */
  previous: number | null;
  /** Seasons the beaten mark stood — or, for a first-ever mark, Seasons
   * since the ledger began. */
  stood: number;
  /** log2(stood), in the same bits of rarity the sender and the digest
   * rank everything else by. */
  weight: number;
}

export function emptyLedger(seasonNumber: number, at: number): RecordLedger {
  return {
    since: { seasonNumber, at },
    marks: {
      season_run: { humans: null, demons: null },
      lead: { humans: null, demons: null },
      reign: { humans: null, demons: null },
    },
    reign: { side: null, since: seasonNumber },
  };
}

/**
 * What a break is worth, in bits.
 *
 * The whole weighting model, and it fits on one line because a record is
 * self-rarefying: maxima get harder to beat as they grow, so the rate at
 * which they fall decays on its own and the age of the beaten mark is
 * already the measure of how unlikely this was. Clamped at one Season so
 * a mark broken immediately scores zero rather than minus infinity.
 */
export function recordWeight(stood: number): number {
  return Math.log2(Math.max(1, stood));
}

/** Who leads, or null if level. */
function leaderOf(score: ContainerScore): Side | null {
  return score.humans === score.demons ? null : score.humans > score.demons ? 'humans' : 'demons';
}

/** The values each side is standing on as a Season closes. Everything
 * here is read off state the coordinator already keeps. */
function candidatesFor(
  ledger: RecordLedger,
  record: ContainerScore,
  streak: SeasonStreak,
  atSeason: number,
): Record<RecordId, Partial<Record<Side, number>>> {
  const leader = leaderOf(record);
  const reignLength = leader && ledger.reign.side === leader ? atSeason - ledger.reign.since + 1 : 1;

  return {
    // Only the side actually on a run has one; the other side's run is
    // zero and zero never beats anything.
    season_run: streak.side ? { [streak.side]: streak.length } : {},
    lead: leader ? { [leader]: Math.abs(record.humans - record.demons) } : {},
    reign: leader ? { [leader]: reignLength } : {},
  };
}

/**
 * Fold a closed Season into the ledger.
 *
 * Pure: returns a new ledger and whatever broke, so the coordinator's
 * Season-close path stays a read, a call and a write, and so the whole
 * thing is testable without a Durable Object.
 *
 * Strictly greater, so equalling a record is not breaking it. That is the
 * conventional rule and it is also the one that keeps this quiet: the
 * all-time lead sits at its own maximum for long stretches by definition,
 * and "the Humans equalled their biggest ever lead" would fire on most of
 * those Seasons and mean nothing by the end of the week.
 */
export function applySeason(
  ledger: RecordLedger,
  season: { seasonNumber: number; record: ContainerScore; streak: SeasonStreak; at: number },
): { ledger: RecordLedger; breaks: RecordBreak[] } {
  // Counted off the record rather than the Season counter, which lags it
  // by one for the length of a season_won pause — the same skew the
  // sender's occurrence keys and the digest's window both work around.
  const atSeason = season.record.humans + season.record.demons;
  const candidates = candidatesFor(ledger, season.record, season.streak, atSeason);

  const marks: Record<RecordId, SideMarks> = { ...ledger.marks };
  const breaks: RecordBreak[] = [];

  for (const id of RECORD_IDS) {
    for (const [side, value] of Object.entries(candidates[id]) as [Side, number][]) {
      const previous = ledger.marks[id][side];
      if (value <= 0 || (previous && value <= previous.value)) continue;

      const stood = atSeason - (previous ? previous.seasonNumber : ledger.since.seasonNumber);
      breaks.push({
        id,
        side,
        value,
        previous: previous?.value ?? null,
        stood,
        weight: recordWeight(stood),
      });
      marks[id] = { ...marks[id], [side]: { value, seasonNumber: atSeason, at: season.at } };
    }
  }

  const leader = leaderOf(season.record);
  const reign =
    leader && ledger.reign.side === leader ? ledger.reign : { side: leader, since: atSeason };

  return { ledger: { ...ledger, marks, reign }, breaks };
}

/**
 * The breaks worth writing down, out of everything that technically broke.
 *
 * Needed because two of the three records are *growing* quantities, not
 * events: while a side holds the lead, their reign is one longer every
 * Season, and each of those beats the mark set one Season earlier. The
 * same is true of a lead being extended, or a run while it is already the
 * longest ever. Measured over 800,000 Seasons, that is 10.94 breaks a day,
 * essentially all of them a counter beating itself.
 *
 * None of it could ever reach a reader — a mark that stood one Season is
 * worth zero bits by construction — but all of it would be written into
 * the Season ring and served to every client that asks for history. So
 * the ones that never survived a Season are dropped at the point of
 * record-keeping, while the ledger's marks still advance for all of them.
 *
 * Deliberately not the digest's 6.5-bit floor: where the bar for *saying*
 * something sits is the digest's business and changes with it, and a
 * history screen should still be able to show a mark that stood a month.
 * This only drops what carries no information at all.
 */
export function notableBreaks(breaks: RecordBreak[]): RecordBreak[] {
  return breaks.filter((broken) => broken.stood > 1);
}

/** The mark for one side, or null. A thin accessor so callers don't index
 * into the shape and get to stay wrong-proof if it changes. */
export function markFor(ledger: RecordLedger, id: RecordId, side: Side): RecordMark | null {
  return ledger.marks[id][side];
}

/**
 * Who holds a record outright, and with what — null when it has never
 * been set or when both sides are level on it.
 *
 * Joshua's call that a record is tracked per side but shown for the
 * leader, which is also the right one for a card: "the longest run ever
 * is 9, by the Humans" is a fact about the game, while printing both
 * sides' bests side by side turns every record into a second scoreboard.
 */
export function recordHolder(
  ledger: RecordLedger,
  id: RecordId,
): { side: Side; mark: RecordMark } | null {
  const { humans, demons } = ledger.marks[id];
  if (!humans && !demons) return null;
  if (humans && demons && humans.value === demons.value) return null;
  if (humans && (!demons || humans.value > demons.value)) return { side: 'humans', mark: humans };
  return demons ? { side: 'demons', mark: demons } : null;
}
