import { describe, expect, it } from 'vitest';
import type { DramaInput, MomentId, Side } from '@total-tossup-live/shared';
import { dramaFor, momentCopy, momentWeight, MOMENT_RATES_PER_DAY } from '@total-tossup-live/shared';

// Lives here rather than in shared/ for the same reason scoring.test.ts
// does: shared/ has no test runner of its own and the worker already has
// vitest wired up.

/**
 * A snapshot-shaped input with nothing at stake: Season 500, Week 1, both
 * containers empty, no streak. Every test below states only the fields
 * it's actually about.
 *
 * The all-time record is deliberately settled (a 20-Season gap) rather
 * than level. A level record is not a neutral starting point — from level,
 * whoever takes the next Season leads all-time, so record_lead fires on
 * every Season point and, being the heaviest moment there is, buries
 * whatever a test was actually about.
 */
function input(over: Partial<DramaInput> = {}): DramaInput {
  return {
    phase: 'flipping',
    seasonNumber: 500,
    weekNumber: 1,
    nightsPerWeek: 7,
    weeksPerSeason: 7,
    weekScore: { humans: 0, demons: 0 },
    seasonScore: { humans: 0, demons: 0 },
    completedNights: [],
    completedWeeks: [],
    seasonStreak: { side: null, length: 0 },
    lifetimeRecord: { humans: 120, demons: 100 },
    ...over,
  };
}

const ids = (over: Partial<DramaInput> = {}): MomentId[] =>
  dramaFor(input(over)).moments.map((moment) => moment.id);

/** Night winners as a completedNights array, 'h'/'d' for brevity. */
const nights = (pattern: string): Side[] =>
  [...pattern].map((c) => (c === 'h' ? 'humans' : 'demons'));

const weeks = (pattern: string) =>
  [...pattern].map((c, i) => ({ weekNumber: i + 1, winner: (c === 'h' ? 'humans' : 'demons') as Side }));

describe('weights', () => {
  it('rises as the measured rate falls', () => {
    // The whole budget rests on this ordering, so assert it directly off
    // the rates rather than trusting the authored numbers to stay sorted.
    // milestone_season is excluded because its weight is overridden on
    // purpose — see the next test.
    const byRate = (Object.keys(MOMENT_RATES_PER_DAY) as MomentId[])
      .filter((id) => id !== 'milestone_season')
      .sort((a, b) => MOMENT_RATES_PER_DAY[b] - MOMENT_RATES_PER_DAY[a]);
    const byWeight = [...byRate].sort((a, b) => momentWeight(a) - momentWeight(b));
    expect(byWeight).toEqual(byRate);
  });

  it('demotes a milestone Season below the moments that are actually at stake', () => {
    // It is the rarest row in the table and the least surprising thing in
    // it: a round-numbered Season is knowable months out. Ranked on
    // frequency alone it outranked the all-time record going level.
    expect(momentWeight('milestone_season')).toBeLessThan(momentWeight('season_decider'));
    expect(momentWeight('milestone_season')).toBeLessThan(momentWeight('record_level'));
    expect(momentWeight('milestone_season')).toBeGreaterThan(momentWeight('week_point'));
  });

  it('puts a Season decider well above a Week decider despite equal odds', () => {
    // Per opportunity these are exactly equally likely -- both are
    // best-of-7 races on a fair coin. The gap is entirely that Night
    // starts outnumber Week starts, which is the thing the budget needs
    // to see and the reason weights are rates in time.
    expect(momentWeight('season_decider')).toBeGreaterThan(momentWeight('week_decider') + 2);
  });
});

describe('nothing at stake', () => {
  it('reports no moments at the start of an ordinary Week', () => {
    expect(dramaFor(input())).toEqual({ moments: [], score: 0 });
  });

  it('stays silent through the pauses that follow a decided container', () => {
    // week_won and season_won are *results*. A sender that treated them
    // as live would notify people about a chance that has already gone.
    for (const phase of ['week_won', 'season_won', 'standby'] as const) {
      expect(ids({ phase, weekScore: { humans: 4, demons: 3 } })).toEqual([]);
    }
  });

  it('ignores a container that is already decided', () => {
    // 4-3 on Nights means the Week is over; the brink test would
    // otherwise still see demons sitting on 3.
    expect(ids({ weekScore: { humans: 4, demons: 3 } })).toEqual([]);
  });
});

describe('the containers', () => {
  it('calls a level Week with one Night left a decider', () => {
    expect(ids({ weekScore: { humans: 3, demons: 3 } })).toEqual(['week_decider']);
  });

  it('names the side that can close a Week out', () => {
    const report = dramaFor(input({ weekScore: { humans: 3, demons: 2 } }));
    expect(report.moments).toEqual([
      { id: 'week_point', weight: momentWeight('week_point'), side: 'humans' },
    ]);
  });

  it('adds a sweep watch when the other side has nothing', () => {
    expect(ids({ weekScore: { humans: 3, demons: 0 } })).toEqual(
      // sweep is rarer than the match point it sits inside, so it sorts first
      ['week_sweep_watch', 'week_point'],
    );
  });

  it('reads the Season the same way off its own container', () => {
    expect(ids({ seasonScore: { humans: 3, demons: 3 } })).toEqual(['season_decider']);
    expect(ids({ seasonScore: { humans: 2, demons: 3 } })).toEqual(['season_point']);
  });

  it('scales to a different container size', () => {
    // debug runs best-of-3, where the brink is 1 rather than 3.
    expect(ids({ nightsPerWeek: 3, weekScore: { humans: 1, demons: 1 } })).toEqual(['week_decider']);
  });
});

describe('title night', () => {
  it('fires only when both containers are level at once', () => {
    const both = ids({
      weekScore: { humans: 3, demons: 3 },
      seasonScore: { humans: 3, demons: 3 },
    });
    expect(both[0]).toBe('title_night');
    expect(both).toContain('week_decider');
    expect(both).toContain('season_decider');

    expect(ids({ weekScore: { humans: 3, demons: 3 }, seasonScore: { humans: 3, demons: 2 } })).not.toContain(
      'title_night',
    );
  });

  it('outranks either decider on its own', () => {
    const score = (over: Partial<DramaInput>) => dramaFor(input(over)).score;
    const solo = score({ seasonScore: { humans: 3, demons: 3 } });
    const title = score({
      weekScore: { humans: 3, demons: 3 },
      seasonScore: { humans: 3, demons: 3 },
    });
    expect(title).toBeGreaterThan(solo);
  });
});

describe('comebacks', () => {
  it('spots a Week that was 0-3 and is now level', () => {
    const report = dramaFor(
      input({ weekScore: { humans: 3, demons: 3 }, completedNights: nights('dddhhh') }),
    );
    expect(report.moments.map((m) => m.id)).toContain('week_comeback');
    // The side that did the trailing is the side coming back -- which is
    // what lets the copy slant either way later.
    expect(report.moments.find((m) => m.id === 'week_comeback')?.side).toBe('humans');
  });

  it('does not call an always-close Week a comeback', () => {
    // Same 3-3 score, never lopsided. The tally cannot tell these apart,
    // which is the entire reason completedNights is persisted.
    expect(ids({ weekScore: { humans: 3, demons: 3 }, completedNights: nights('hdhdhd') })).toEqual([
      'week_decider',
    ]);
  });

  it('needs the trailing side to have actually drawn level', () => {
    // 0-3 down and back to 2-3 is a recovery, not yet a comeback -- and
    // at 2-3 the Week is a match point rather than a decider anyway.
    expect(ids({ weekScore: { humans: 2, demons: 3 }, completedNights: nights('dddhh') })).not.toContain(
      'week_comeback',
    );
  });

  it('does not call a one-Night deficit a comeback', () => {
    // debug runs best-of-3, where the brink is 1 — so every decider it
    // ever reaches came through 0-1, and treating that as a comeback made
    // the criterion fire on all of them. Found by watching the real
    // channel rather than by a fixture.
    expect(ids({ nightsPerWeek: 3, weekScore: { humans: 1, demons: 1 }, completedNights: nights('dh') })).toEqual(
      ['week_decider'],
    );
  });

  it('reads a Season comeback off the Week winners', () => {
    const report = dramaFor(
      input({ seasonScore: { humans: 3, demons: 3 }, completedWeeks: weeks('hhhddd') }),
    );
    expect(report.moments[0].id).toBe('season_comeback');
    expect(report.moments[0].side).toBe('demons');
  });
});

describe('streaks and the record books', () => {
  it('puts a 3+ streak on the line once the Season is winnable', () => {
    const report = dramaFor(
      input({
        seasonScore: { humans: 3, demons: 2 },
        seasonStreak: { side: 'demons', length: 3 },
      }),
    );
    const streak = report.moments.find((m) => m.id === 'streak_on_line');
    // Attributed to whoever holds it, not to whoever is ahead -- the
    // framing ("extends" or "ends") is the copy's job.
    expect(streak?.side).toBe('demons');
  });

  it('leaves a short streak alone', () => {
    expect(
      ids({ seasonScore: { humans: 3, demons: 2 }, seasonStreak: { side: 'demons', length: 2 } }),
    ).not.toContain('streak_on_line');
  });

  it('catches an all-time record about to be drawn level', () => {
    // The live main channel, near enough: 594-593 with the trailing side
    // one Season away.
    const report = dramaFor(
      input({
        seasonScore: { humans: 2, demons: 3 },
        lifetimeRecord: { humans: 594, demons: 593 },
      }),
    );
    const record = report.moments.find((m) => m.id === 'record_level');
    expect(record?.side).toBe('demons');
    // It should be the thing a sender picks out of that whole snapshot.
    expect(report.moments[0].id).toBe('record_level');
  });

  it('distinguishes drawing level from taking the lead', () => {
    expect(
      ids({ seasonScore: { humans: 2, demons: 3 }, lifetimeRecord: { humans: 594, demons: 594 } }),
    ).toContain('record_lead');
    // Extending an existing lead is not news.
    expect(
      ids({ seasonScore: { humans: 3, demons: 2 }, lifetimeRecord: { humans: 594, demons: 593 } }),
    ).not.toContain('record_lead');
  });

  it('says nothing about the record on a channel that has no history', () => {
    // A fresh channel is 0-0 all-time, which is dead level, so "whoever
    // wins leads all-time" is true on its first Week and means nothing.
    // Caught by running the real debug channel, not by a fixture.
    expect(ids({ seasonScore: { humans: 3, demons: 2 }, lifetimeRecord: { humans: 0, demons: 0 } })).toEqual([
      'season_point',
    ]);
    expect(ids({ seasonScore: { humans: 3, demons: 2 }, lifetimeRecord: { humans: 1, demons: 0 } })).not.toContain(
      'record_lead',
    );
  });

  it('considers both sides in a Season decider', () => {
    // Level on Weeks and level all-time: whoever wins takes the lead, so
    // it holds for both sides at once.
    const report = dramaFor(
      input({
        seasonScore: { humans: 3, demons: 3 },
        lifetimeRecord: { humans: 594, demons: 594 },
      }),
    );
    expect(report.moments.filter((m) => m.id === 'record_lead')).toHaveLength(2);
  });
});

describe('milestones', () => {
  it('fires on a round-numbered Season, at its launch', () => {
    expect(ids({ phase: 'season_launch', seasonNumber: 1200 })).toEqual(['milestone_season']);
    expect(ids({ phase: 'season_launch', seasonNumber: 1201 })).toEqual([]);
  });

  it('claims nothing else before a Season has begun', () => {
    // Both containers are empty at season_launch by definition, so a
    // stale score here must not produce a decider.
    expect(ids({ phase: 'season_launch', seasonNumber: 1200, weekScore: { humans: 3, demons: 3 } })).toEqual(
      ['milestone_season'],
    );
  });
});

describe('copy', () => {
  it('writes every moment a line', () => {
    // A missing case would be an undefined title on someone's lock
    // screen, so walk the whole enum rather than the ones in use.
    for (const id of Object.keys(MOMENT_RATES_PER_DAY) as MomentId[]) {
      const copy = momentCopy({ id, weight: momentWeight(id), side: 'humans' }, input());
      expect(copy.label.length).toBeGreaterThan(0);
      expect(copy.title.length).toBeGreaterThan(0);
      expect(copy.body.length).toBeGreaterThan(0);
    }
  });

  it('names the side a moment belongs to', () => {
    const copy = momentCopy(
      { id: 'week_point', weight: 0, side: 'demons' },
      input({ weekNumber: 4, weekScore: { humans: 2, demons: 3 } }),
    );
    expect(copy.title).toContain('Demons');
    expect(copy.title).toContain('Week 4');
  });

  it('leaves a decider unattributed', () => {
    const copy = momentCopy({ id: 'week_decider', weight: 0, side: null }, input({ weekNumber: 6 }));
    expect(copy.title).toContain('Week 6');
    expect(copy.title).not.toContain('Humans');
    expect(copy.title).not.toContain('Demons');
  });
});
