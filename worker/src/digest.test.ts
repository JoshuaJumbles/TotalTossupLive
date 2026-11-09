import { describe, expect, it } from 'vitest';
import type { DigestPoint, HeadlineId, RecordBreak, SeasonSummary, Side } from '@total-tossup-live/shared';
import {
  DEFAULT_DIGEST_POLICY,
  DIGEST_RATES_PER_DAY,
  awayLabel,
  digestBetween,
  digestLines,
  headlineWeight,
  recordWeight,
  runWeight,
} from '@total-tossup-live/shared';

// Here rather than in shared/ for the same reason drama.test.ts and
// notify.test.ts are: shared/ has no test runner of its own.

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** The main channel's shape, mid-Season, nothing unusual: Season 1,197 on
 * Week 2, a settled all-time record, no run going. Every test states only
 * what it's about. */
function point(over: Partial<DigestPoint> = {}): DigestPoint {
  return {
    seenAt: 0,
    seasonNumber: 1197,
    weekNumber: 2,
    nightsPerWeek: 7,
    weeksPerSeason: 7,
    weekScore: { humans: 0, demons: 0 },
    seasonScore: { humans: 1, demons: 0 },
    completedWeeks: [{ weekNumber: 1, winner: 'humans' }],
    lifetimeRecord: { humans: 601, demons: 595 },
    seasonStreak: { side: 'humans', length: 1 },
    ...over,
  };
}

const weeks = (pattern: string) =>
  [...pattern].map((c, i) => ({ weekNumber: i + 1, winner: (c === 'h' ? 'humans' : 'demons') as Side }));

const ids = (digest: { headlines: { id: HeadlineId }[] } | null): HeadlineId[] =>
  digest ? digest.headlines.map((h) => h.id) : [];

/** A settled Season from a Week-order string, as /recent would return it. */
const summary = (pattern: string, over: Partial<SeasonSummary> = {}): SeasonSummary => ({
  seasonNumber: 1197,
  weeks: [...pattern].map((c) => (c === 'h' ? 'humans' : 'demons') as Side),
  weeksPerSeason: 7,
  endedAt: 0,
  record: { humans: 601, demons: 595 },
  streak: { side: 'humans', length: 1 },
  ...over,
});

describe('declining to exist', () => {
  it('returns nothing for a quick look away', () => {
    const then = point();
    const now = point({ seenAt: 90 * 1000, weekScore: { humans: 2, demons: 1 } });
    expect(digestBetween(then, now)).toBeNull();
  });

  it('returns nothing when only Weeks settled', () => {
    // A Week closing is ninety-three-a-day furniture. It's context when
    // something else earned the card, and never a reason for one.
    const then = point();
    const now = point({
      seenAt: 40 * MINUTE,
      seasonScore: { humans: 2, demons: 1 },
      completedWeeks: weeks('hdh'),
      weekNumber: 4,
    });
    expect(digestBetween(then, now)).toBeNull();
  });

  it('returns nothing when a Season settled unremarkably', () => {
    // One Season went by, nobody's run was at stake, the record stayed
    // where it was. Meaty and rare means this is not a digest.
    const then = point();
    const now = point({
      seenAt: 2 * HOUR,
      seasonNumber: 1198,
      weekNumber: 1,
      seasonScore: { humans: 0, demons: 0 },
      completedWeeks: [],
      lifetimeRecord: { humans: 601, demons: 596 },
      seasonStreak: { side: 'demons', length: 1 },
    });
    expect(digestBetween(then, now)).toBeNull();
  });
});

describe('the record', () => {
  it('leads with the all-time lead changing hands', () => {
    const then = point({ lifetimeRecord: { humans: 600, demons: 600 } });
    const now = point({
      seenAt: 2 * HOUR,
      seasonNumber: 1201,
      lifetimeRecord: { humans: 600, demons: 601 },
      seasonStreak: { side: 'demons', length: 1 },
    });
    const digest = digestBetween(then, now)!;
    expect(ids(digest)).toContain('record_changed_hands');
    expect(digest.headlines[0].id).toBe('record_changed_hands');
    expect(digest.headlines[0].side).toBe('demons');
  });

  it('leads with the record being drawn level', () => {
    const then = point({ lifetimeRecord: { humans: 601, demons: 600 } });
    const now = point({
      seenAt: 2 * HOUR,
      lifetimeRecord: { humans: 601, demons: 601 },
      seasonStreak: { side: 'demons', length: 1 },
    });
    expect(digestBetween(then, now)!.headlines[0].id).toBe('record_drawn_level');
  });

  it('says nothing about a record that merely grew', () => {
    const then = point({ lifetimeRecord: { humans: 601, demons: 595 } });
    const now = point({
      seenAt: 2 * HOUR,
      lifetimeRecord: { humans: 602, demons: 595 },
      seasonStreak: { side: 'humans', length: 2 },
    });
    expect(ids(digestBetween(then, now))).not.toContain('record_changed_hands');
  });
});

describe('runs', () => {
  it('reports a run ending, with the length it reached', () => {
    const then = point({ seasonStreak: { side: 'humans', length: 5 } });
    const now = point({
      seenAt: 2 * HOUR,
      seasonNumber: 1198,
      lifetimeRecord: { humans: 601, demons: 596 },
      seasonStreak: { side: 'demons', length: 1 },
    });
    const digest = digestBetween(then, now)!;
    expect(ids(digest)).toContain('streak_broken');
    expect(digestLines(digest).headlines[0]).toBe("Humans' 5-Season run is over");
  });

  it('reports a run ending even when the same side started a new one', () => {
    // Found on live data within a minute of looking at it: the Demons were
    // on five and were on one when I came back. The run ended — a side
    // winning again after losing doesn't make it the same run — and
    // checking only whether the side changed misses it.
    const then = point({ seasonStreak: { side: 'demons', length: 5 } });
    const now = point({
      seenAt: 3 * HOUR,
      seasonNumber: 1199,
      lifetimeRecord: { humans: 603, demons: 596 },
      seasonStreak: { side: 'demons', length: 1 },
    });
    expect(ids(digestBetween(then, now))).toContain('streak_broken');
  });

  it('ignores a short run ending', () => {
    const then = point({ seasonStreak: { side: 'humans', length: 2 } });
    const now = point({
      seenAt: 2 * HOUR,
      lifetimeRecord: { humans: 601, demons: 596 },
      seasonStreak: { side: 'demons', length: 1 },
    });
    expect(ids(digestBetween(then, now))).not.toContain('streak_broken');
  });

  it('reports a run reaching three', () => {
    const then = point({ seasonStreak: { side: 'demons', length: 2 } });
    const now = point({
      seenAt: 2 * HOUR,
      lifetimeRecord: { humans: 601, demons: 596 },
      seasonStreak: { side: 'demons', length: 3 },
    });
    expect(ids(digestBetween(then, now))).toContain('streak_started');
  });

  it('keeps an extended run below the headline bar', () => {
    // "Their run is over" is news; "they won another one" is not — and
    // the two are *provably* equally rare, both 2.0 a day, so rarity
    // cannot make this distinction and an override has to. Assert the
    // identity as well as the override, since the override only earns its
    // place while the rates really are equal.
    expect(DIGEST_RATES_PER_DAY.streak_extended).toBe(DIGEST_RATES_PER_DAY.streak_broken);
    expect(headlineWeight('streak_broken')).toBeGreaterThan(DEFAULT_DIGEST_POLICY.weightFloor);
    expect(headlineWeight('streak_extended')).toBeLessThan(DEFAULT_DIGEST_POLICY.weightFloor);

    const then = point({ seasonStreak: { side: 'humans', length: 4 } });
    const now = point({
      seenAt: 2 * HOUR,
      lifetimeRecord: { humans: 602, demons: 595 },
      seasonStreak: { side: 'humans', length: 5 },
    });
    expect(digestBetween(then, now)).toBeNull();
  });
});

describe('comebacks', () => {
  it('reports one that came together while away', () => {
    const then = point({ seasonScore: { humans: 0, demons: 3 }, completedWeeks: weeks('ddd'), weekNumber: 4 });
    const now = point({
      seenAt: 50 * MINUTE,
      seasonScore: { humans: 3, demons: 3 },
      completedWeeks: weeks('dddhhh'),
      weekNumber: 7,
    });
    expect(ids(digestBetween(then, now))).toContain('season_comeback');
  });

  it('stays quiet about one that had already happened before you left', () => {
    const level = { seasonScore: { humans: 3, demons: 3 }, completedWeeks: weeks('dddhhh'), weekNumber: 7 };
    const then = point(level);
    const now = point({ ...level, seenAt: 20 * MINUTE, weekScore: { humans: 2, demons: 1 } });
    expect(digestBetween(then, now)).toBeNull();
  });
});

describe('how long you were gone', () => {
  it('demotes an event you would expect to have happened', () => {
    // A run ending is exactly as rare after two weeks as after two hours.
    // What changes is that you would expect twenty-eight of them, so
    // reporting one as a headline would be absurd.
    const then = point({ seasonStreak: { side: 'humans', length: 5 } });
    const away = (ms: number) =>
      ids(
        digestBetween(
          then,
          point({
            seenAt: ms,
            lifetimeRecord: { humans: 601, demons: 596 },
            seasonStreak: { side: 'demons', length: 1 },
          }),
        ),
      );
    expect(away(2 * HOUR)).toContain('streak_broken');
    expect(away(14 * DAY)).not.toContain('streak_broken');
  });

  it('switches to a summary when too many Seasons went by to name them', () => {
    const then = point({ lifetimeRecord: { humans: 601, demons: 595 } });
    const now = point({
      seenAt: 8 * DAY,
      seasonNumber: 1309,
      lifetimeRecord: { humans: 659, demons: 649 },
      seasonStreak: { side: 'humans', length: 1 },
    });
    const digest = digestBetween(then, now)!;
    expect(digest.register).toBe('summarised');
    // Nothing rate-based survives an eight-day absence, and that's fine —
    // the summary is the thing worth saying by then.
    expect(digest.headlines).toEqual([]);
    expect(digestLines(digest).context[0]).toBe('112 Seasons settled — 58-54.');
  });

  it('still leads with a lopsided absence, which only gets more reportable', () => {
    const then = point();
    const now = point({
      seenAt: 2 * DAY,
      seasonNumber: 1225,
      lifetimeRecord: { humans: 624, demons: 599 },
      seasonStreak: { side: 'humans', length: 2 },
    });
    const digest = digestBetween(then, now)!;
    // 23 of 27 to one side: improbable enough to be the story.
    expect(digest.headlines[0].id).toBe('season_run');
    expect(digestLines(digest).headlines[0]).toBe('Humans took 23 of 27 Seasons');
  });

  it('says nothing about an absence that split evenly', () => {
    const then = point();
    const now = point({
      seenAt: 2 * DAY,
      seasonNumber: 1225,
      lifetimeRecord: { humans: 616, demons: 607 },
      seasonStreak: { side: 'humans', length: 1 },
    });
    expect(ids(digestBetween(then, now))).not.toContain('season_run');
  });

  it('scores a run by how improbable it is', () => {
    expect(runWeight(2, 2)).toBe(0); // too few to mean anything
    expect(runWeight(10, 5)).toBeLessThan(1); // a dead split
    expect(runWeight(10, 9)).toBeGreaterThan(runWeight(10, 7));
    expect(runWeight(28, 23)).toBeGreaterThan(DEFAULT_DIGEST_POLICY.weightFloor);
  });
});

describe('volume', () => {
  it('never shows more than the policy allows', () => {
    // Everything at once: the record changes hands, a long run ends, and
    // the Season came back from the brink.
    const then = point({
      lifetimeRecord: { humans: 600, demons: 600 },
      seasonStreak: { side: 'humans', length: 6 },
      seasonScore: { humans: 0, demons: 3 },
      completedWeeks: weeks('ddd'),
    });
    const now = point({
      seenAt: 2 * HOUR,
      lifetimeRecord: { humans: 600, demons: 601 },
      seasonStreak: { side: 'demons', length: 1 },
      seasonScore: { humans: 3, demons: 3 },
      completedWeeks: weeks('dddhhh'),
      weekNumber: 7,
    });
    const digest = digestBetween(then, now)!;
    expect(digest.headlines.length).toBeLessThanOrEqual(DEFAULT_DIGEST_POLICY.maxHeadlines);
    expect(digest.headlines.map((h) => h.weight)).toEqual(
      [...digest.headlines.map((h) => h.weight)].sort((a, b) => b - a),
    );
  });

  it('keeps the high-rate events as context and never as headlines', () => {
    const everyRate = Object.keys(DIGEST_RATES_PER_DAY) as (keyof typeof DIGEST_RATES_PER_DAY)[];
    const headlineCapable = everyRate.filter(
      (id) => headlineWeight(id) >= DEFAULT_DIGEST_POLICY.weightFloor,
    );
    // The table is deliberately mostly non-headline material.
    expect(headlineCapable.sort()).toEqual([
      'record_changed_hands',
      'record_drawn_level',
      'season_comeback',
      'season_swept',
      'season_won_from_brink',
      'streak_broken',
      'streak_started',
    ]);
    // And the heaviest of them is a Season won from the brink, ahead of the
    // all-time lead changing hands. Stated as a test because it's the one
    // ordering in the table that was a surprise.
    expect(headlineWeight('season_won_from_brink')).toBeGreaterThan(headlineWeight('record_changed_hands'));
  });

  it('demotes a milestone Season the way the sender does', () => {
    expect(headlineWeight('milestone_passed')).toBeLessThan(DEFAULT_DIGEST_POLICY.weightFloor);
    const then = point({ seasonNumber: 1199, lifetimeRecord: { humans: 601, demons: 597 } });
    const now = point({
      seenAt: 2 * HOUR,
      seasonNumber: 1201,
      lifetimeRecord: { humans: 602, demons: 598 },
      seasonStreak: { side: 'demons', length: 1 },
    });
    // A round number went by and nothing else did, so there's no card.
    expect(digestBetween(then, now)).toBeNull();
  });
});

describe('copy', () => {
  it('names the Season that settled, not the one in progress', () => {
    // During the season_won pause the record is credited but the counter
    // hasn't moved, so seasonNumber - 1 would name the wrong Season.
    const then = point({ seasonStreak: { side: 'humans', length: 5 } });
    const now = point({
      seenAt: 2 * HOUR,
      seasonNumber: 1197, // still mid-pause, not yet advanced
      lifetimeRecord: { humans: 601, demons: 596 },
      seasonStreak: { side: 'demons', length: 1 },
    });
    const lines = digestLines(digestBetween(then, now)!);
    expect(lines.context).toContain('Demons took Season 1,197.');
  });

  it('rounds the absence to something a person would say', () => {
    expect(awayLabel(30 * 1000)).toBe('1m');
    expect(awayLabel(18 * MINUTE)).toBe('18m');
    expect(awayLabel(2 * HOUR)).toBe('2h');
    expect(awayLabel(2 * HOUR + 40 * MINUTE)).toBe('2h 40m');
    expect(awayLabel(26 * HOUR)).toBe('a day');
    expect(awayLabel(8 * DAY)).toBe('8 days');
  });

  it('states where the live Season stands, always', () => {
    const then = point({ seasonStreak: { side: 'humans', length: 5 } });
    const now = point({
      seenAt: 2 * HOUR,
      seasonNumber: 1198,
      weekNumber: 3,
      seasonScore: { humans: 1, demons: 1 },
      completedWeeks: weeks('hd'),
      lifetimeRecord: { humans: 601, demons: 596 },
      seasonStreak: { side: 'demons', length: 1 },
    });
    const lines = digestLines(digestBetween(then, now)!);
    expect(lines.title).toBe('While you were away — 2h');
    expect(lines.context).toContain('Season 1,198 is on Week 3, level at 1-1.');
    expect(lines.context).toContain('All-time: 601-596.');
  });
});

describe('what the Season ring adds', () => {
  /** Two Seasons settled while away: 1,197 swept by the Humans, 1,198
   * taken by the Demons from 0-3 down in a Week 7 decider. The viewer left
   * with Season 1,197 about to start and a 601-595 record, so the
   * boundary-crossing case throughout. */
  const away = {
    then: point({ seasonNumber: 1197, lifetimeRecord: { humans: 601, demons: 595 } }),
    now: point({
      seenAt: 3 * HOUR,
      seasonNumber: 1199,
      weekNumber: 1,
      seasonScore: { humans: 0, demons: 0 },
      completedWeeks: [],
      lifetimeRecord: { humans: 602, demons: 596 },
      seasonStreak: { side: 'demons', length: 1 },
    }),
    seasons: [
      summary('hhhh', { seasonNumber: 1197 }),
      summary('hhhdddd', { seasonNumber: 1198 }),
    ],
  };

  it('is the difference between a digest and no digest at all', () => {
    // Nothing the diff can see here clears the floor — one Season each way,
    // the record leader unchanged, no run worth naming — so without history
    // the honest answer is no card. The same absence with history has the
    // best Season of the day in it.
    expect(digestBetween(away.then, away.now)).toBeNull();
    expect(ids(digestBetween(away.then, away.now, away.seasons)).sort()).toEqual([
      'season_swept',
      'season_won_from_brink',
    ]);
  });

  it('leads with the Season won from the brink over the sweep', () => {
    // 9.64 bits against 6.64. Both clear the floor; only one of them is the
    // best thing the game produces.
    const digest = digestBetween(away.then, away.now, away.seasons)!;
    expect(digest.headlines[0].id).toBe('season_won_from_brink');
    expect(digest.headlines[0].side).toBe('demons');
  });

  it('names each Season, with the decider as a clause and never a headline', () => {
    const lines = digestLines(digestBetween(away.then, away.now, away.seasons)!);
    expect(lines.context).toContain('Humans took Season 1,197 without dropping a Week.');
    // Winner first here, unlike every other score in the app — the
    // sentence has just named them, so "3-4" would read as a loss.
    expect(lines.context).toContain('Demons took Season 1,198, 4-3 in a Week 7 decider.');
    expect(lines.headlines).toContain('Demons won a Season from the brink');
    // "Went the distance" is 5.32 bits and lives in the sentence above, not
    // in the stack of capitals.
    expect(lines.headlines.join(' ')).not.toContain('decider');
  });

  it('falls back to counting when the ring cannot account for every Season', () => {
    // Four settled, two still in the ring. Naming the two would read as the
    // whole story, so it counts instead — a partial list is worse than a
    // total.
    const now = point({
      seenAt: 6 * HOUR,
      seasonNumber: 1201,
      lifetimeRecord: { humans: 603, demons: 597 },
      completedWeeks: [],
      seasonStreak: { side: 'demons', length: 1 },
    });
    const lines = digestLines(digestBetween(away.then, now, away.seasons)!);
    expect(lines.context).toContain('4 Seasons settled — 2-2.');
    expect(lines.context.join(' ')).not.toContain('Season 1,197');
  });

  it('ignores the Season the viewer watched finish', () => {
    // A point captured during a season_won pause has the record already
    // credited and the counter not yet advanced. Keyed off the record, so
    // Season 1,197 is correctly in the past rather than reported back.
    const then = point({ seasonNumber: 1197, lifetimeRecord: { humans: 602, demons: 595 } });
    const now = point({
      seenAt: 3 * HOUR,
      seasonNumber: 1199,
      completedWeeks: [],
      lifetimeRecord: { humans: 602, demons: 596 },
      seasonStreak: { side: 'demons', length: 1 },
    });
    expect(ids(digestBetween(then, now, away.seasons))).not.toContain('season_swept');
  });

  it('still gates a sweep on an absence long enough to expect one', () => {
    // 2.0 a day, ceiling 1, so a sweep stops being news at twelve hours.
    // The ring makes it visible; expectation decides whether it matters.
    const long = point({ ...away.now, seenAt: 2 * DAY, seasonNumber: 1199 });
    expect(ids(digestBetween(away.then, long, away.seasons))).not.toContain('season_swept');
  });

  it('ignores a Season that settled after the snapshot it is measuring', () => {
    // The ring and the snapshot are separate reads, so the ring can be a
    // moment newer. Here nothing has settled between the two points at all,
    // and the ring is still holding Seasons — clamped at both ends, so they
    // are outside the window and stay out of it. Without the upper bound
    // this reports two headlines about Seasons the viewer has not missed.
    const then = point();
    const now = point({ seenAt: 3 * HOUR, weekNumber: 4, completedWeeks: weeks('hdh') });
    expect(digestBetween(then, now, away.seasons)).toBeNull();
  });

  it('is never consulted when no Season settled', () => {
    // Same Season at both ends: the live snapshot still holds this Season's
    // whole Week order, so history has nothing to add and the web client
    // makes no request at all.
    const then = point({ completedWeeks: weeks('ddd'), seasonScore: { humans: 0, demons: 3 } });
    // Level from 0-3 with a Week still to play, which is the live reading
    // and the one still worth a card: a situation, not a result.
    const now = point({
      seenAt: 3 * HOUR,
      weekNumber: 7,
      completedWeeks: weeks('dddhhh'),
      seasonScore: { humans: 3, demons: 3 },
    });
    expect(ids(digestBetween(then, now))).toEqual(ids(digestBetween(then, now, away.seasons)));
    expect(ids(digestBetween(then, now))).toContain('season_comeback');
  });
});

describe('an all-time record, in a digest', () => {
  const broken = (over: Partial<RecordBreak> = {}): RecordBreak => ({
    id: 'season_run',
    side: 'humans',
    value: 9,
    previous: 4,
    stood: 401,
    weight: recordWeight(401),
    ...over,
  });

  /** One Season settled while away, and it broke something. */
  const withBreaks = (records: RecordBreak[]) => ({
    then: point({ seasonNumber: 1198, lifetimeRecord: { humans: 600, demons: 598 } }),
    now: point({
      seenAt: 2 * HOUR,
      seasonNumber: 1200,
      weekNumber: 1,
      completedWeeks: [],
      lifetimeRecord: { humans: 601, demons: 598 },
      seasonStreak: { side: 'humans', length: 9 },
    }),
    seasons: [summary('hhhhh', { seasonNumber: 1199, records })],
  });

  it('leads the digest when the mark it beat was old', () => {
    const { then, now, seasons } = withBreaks([broken()]);
    const digest = digestBetween(then, now, seasons)!;
    expect(digest.headlines[0].id).toBe('record_broken');
    // 8.65 bits. It clears the floor comfortably and outranks the streak
    // headlines — but a Season won from the brink, at 9.64, still beats
    // it, which is the right way round: coming back from 0-3 and winning
    // is rarer than a four-hundred-Season-old mark falling.
    expect(digest.headlines[0].weight).toBeGreaterThan(headlineWeight('streak_broken'));
    expect(digest.headlines[0].weight).toBeLessThan(headlineWeight('season_won_from_brink'));
    expect(digestLines(digest).headlines).toContain("Humans' 9-Season run is an all-time record");
  });

  it('stays out of it when the mark it beat was days old', () => {
    // The same event, same side, same value — only the age of what it
    // beat is different, and that is the whole criterion.
    const { then, now, seasons } = withBreaks([
      broken({ previous: 8, stood: 5, weight: recordWeight(5) }),
    ]);
    expect(ids(digestBetween(then, now, seasons))).not.toContain('record_broken');
  });

  it('reports only the heaviest when two fell at once', () => {
    const { then, now, seasons } = withBreaks([
      broken({ id: 'lead', value: 38, previous: 37, stood: 3, weight: recordWeight(3) }),
      broken({ id: 'reign', value: 340, previous: 120, stood: 600, weight: recordWeight(600) }),
    ]);
    const digest = digestBetween(then, now, seasons)!;
    expect(digest.headlines.filter((h) => h.id === 'record_broken')).toHaveLength(1);
    expect(digest.context.recordBreak!.id).toBe('reign');
    expect(digestLines(digest).headlines).toContain(
      "Humans' 340 Seasons in front is an all-time record",
    );
  });

  it('is unaffected by how long the absence was', () => {
    // Every other headline is gated by expected count, because its rate
    // is flat across an absence. A record's is not — it decays as the
    // mark grows — so a fortnight away cannot demote one.
    const { then, seasons } = withBreaks([broken()]);
    const fortnight = point({
      seenAt: 14 * DAY,
      seasonNumber: 1200,
      completedWeeks: [],
      lifetimeRecord: { humans: 601, demons: 598 },
      seasonStreak: { side: 'humans', length: 9 },
    });
    expect(ids(digestBetween(then, fortnight, seasons))).toContain('record_broken');
  });

  it('is simply absent from a ring written before the ledger existed', () => {
    const { then, now } = withBreaks([]);
    const old = [summary('hhhhh', { seasonNumber: 1199 })];
    delete (old[0] as { records?: unknown }).records;
    expect(ids(digestBetween(then, now, old))).not.toContain('record_broken');
  });
});
