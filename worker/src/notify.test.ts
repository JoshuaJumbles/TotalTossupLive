import { describe, expect, it } from 'vitest';
import type { DramaInput, DramaReport, MomentId, Side } from '@total-tossup-live/shared';
import {
  DEFAULT_NOTIFY_POLICY,
  MOMENT_RATES_PER_DAY,
  MOMENT_SCOPES,
  NotificationBudget,
  dramaFor,
  momentWeight,
  occurrenceKey,
} from '@total-tossup-live/shared';

// Here rather than in shared/ for the same reason drama.test.ts is: shared/
// has no test runner of its own and the worker already has vitest wired up.

/** The main channel's shape, nothing at stake, a settled all-time record —
 * same baseline as drama.test.ts, and for the same reason: a level record
 * makes record_lead fire on everything and bury whatever a test is about. */
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

const nights = (pattern: string): Side[] =>
  [...pattern].map((c) => (c === 'h' ? 'humans' : 'demons'));

const weeks = (pattern: string) =>
  [...pattern].map((c, i) => ({ weekNumber: i + 1, winner: (c === 'h' ? 'humans' : 'demons') as Side }));

/** A report carrying exactly the named moments, for the tests that are
 * about the budget rather than about detection. */
function report(...ids: MomentId[]): DramaReport {
  const moments = ids
    .map((id) => ({ id, weight: momentWeight(id), side: null }))
    .sort((a, b) => b.weight - a.weight);
  return { moments, score: moments[0]?.weight ?? 0 };
}

const verdicts = (candidates: { verdict: string }[]) => candidates.map((c) => c.verdict);

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('occurrence identity', () => {
  it('scopes every moment there is', () => {
    // An unscoped moment would key on the wrong container and either
    // repeat or vanish, so assert the table is total rather than trusting
    // the type to have been kept up to date by hand.
    expect(Object.keys(MOMENT_SCOPES).sort()).toEqual(Object.keys(MOMENT_RATES_PER_DAY).sort());
  });

  it('stays the same while the moment stays live', () => {
    const budget = new NotificationBudget();
    const at = input({ weekScore: { humans: 3, demons: 3 }, completedNights: nights('hhhddd') });
    const drama = dramaFor(at);

    const first = budget.consider(drama, at, 0);
    expect(first.map((c) => c.moment.id)).toContain('week_decider');
    // The deciding Night runs for about two and a half minutes and the
    // coordinator broadcasts every two seconds through all of it.
    for (let t = 2000; t < 150_000; t += 2000) {
      expect(budget.consider(drama, at, t)).toEqual([]);
    }
  });

  it('survives the night_won boundary that nightNumber does not', () => {
    // The hazard being avoided: resolveFlip writes the new weekScore but
    // leaves nightNumber naming the Night that just ended, and
    // beginNextStep advances it a beat later. Both of these are the same
    // deciding Night, under two different Night numbers.
    //
    // The counter is spelled out here even though DramaInput has no field
    // for it — which is the point. A snapshot carries one, so anything
    // keying off a snapshot could reach for it; this input type doesn't
    // expose one, so occurrenceKey can't.
    const pause: DramaInput & { nightNumber: number } = {
      ...input({
        phase: 'night_won',
        weekScore: { humans: 3, demons: 3 },
        completedNights: nights('hhhddd'),
      }),
      nightNumber: 6,
    };
    const begun = { ...pause, phase: 'flipping' as const, nightNumber: 7 };

    const budget = new NotificationBudget();
    expect(budget.consider(dramaFor(pause), pause, 0)).not.toEqual([]);
    expect(budget.consider(dramaFor(begun), begun, 10_000)).toEqual([]);
  });

  it('counts a Night-scoped moment again on the next Night', () => {
    const fifth = input({ weekScore: { humans: 3, demons: 1 } });
    const sixth = input({ weekScore: { humans: 3, demons: 2 } });
    expect(occurrenceKey(dramaFor(fifth).moments[0], fifth)).not.toEqual(
      occurrenceKey(dramaFor(sixth).moments[0], sixth),
    );
  });

  it('holds a Week-scoped moment across the Week it belongs to', () => {
    // A Season point lasts the whole Week, so every Night inside it has to
    // land on one key — otherwise a Week at 3-1 sends seven times.
    const base = { seasonScore: { humans: 3, demons: 1 }, completedWeeks: weeks('hhhd') };
    const keys = new Set(
      [0, 1, 2, 3, 4].map((played) => {
        const at = input({ ...base, weekScore: { humans: played, demons: 0 } });
        const moment = dramaFor(at).moments.find((m) => m.id === 'season_point')!;
        return occurrenceKey(moment, at);
      }),
    );
    expect(keys.size).toBe(1);
  });

  it('separates the same moment in a later Season', () => {
    const over = { seasonScore: { humans: 3, demons: 1 }, completedWeeks: weeks('hhhd') };
    const now = input(over);
    const later = input({ ...over, seasonNumber: 501 });
    const of = (at: DramaInput) =>
      occurrenceKey(dramaFor(at).moments.find((m) => m.id === 'season_point')!, at);
    expect(of(now)).not.toEqual(of(later));
  });
});

describe('starting up', () => {
  it('says nothing about a moment that was already running when it arrived', () => {
    const at = input({
      weekScore: { humans: 3, demons: 3 },
      seasonScore: { humans: 3, demons: 3 },
      completedNights: nights('hdhdhd'),
      completedWeeks: weeks('hdhdhd'),
    });
    const budget = new NotificationBudget();
    budget.prime(dramaFor(at), at, 0);
    // Mid-way through the very title Night it would otherwise have sent.
    expect(budget.consider(dramaFor(at), at, 60_000)).toEqual([]);
    expect(budget.sentWithin(HOUR)).toEqual([]);
  });

  it('still catches the next one', () => {
    const running = input({ weekScore: { humans: 3, demons: 2 } });
    const budget = new NotificationBudget();
    budget.prime(dramaFor(running), running, 0);
    const next = input({
      weekScore: { humans: 3, demons: 3 },
      seasonScore: { humans: 3, demons: 3 },
      completedNights: nights('hdhdhd'),
      completedWeeks: weeks('hdhdhd'),
    });
    expect(budget.consider(dramaFor(next), next, 150_000)[0].verdict).toBe('send');
  });
});

describe('the floor', () => {
  it('is set where the measured rates add up to the budget', () => {
    // The floor is the designed answer and the adaptive threshold is only
    // its correction, so it has to stand on its own: everything at or
    // above it should occur about budgetPerDay times a day.
    const rate = (Object.keys(MOMENT_RATES_PER_DAY) as MomentId[])
      .filter((id) => momentWeight(id) >= DEFAULT_NOTIFY_POLICY.weightFloor)
      .reduce((sum, id) => sum + MOMENT_RATES_PER_DAY[id], 0);
    expect(rate).toBeCloseTo(DEFAULT_NOTIFY_POLICY.budgetPerDay, 0);
  });

  it('turns away the moments that happen all day', () => {
    const budget = new NotificationBudget();
    const at = input({ weekScore: { humans: 3, demons: 2 } });
    expect(verdicts(budget.consider(dramaFor(at), at, 0))).toEqual(['below_threshold']);
  });

  it('sends a title Night', () => {
    const at = input({
      weekScore: { humans: 3, demons: 3 },
      seasonScore: { humans: 3, demons: 3 },
      completedNights: nights('hdhdhd'),
      completedWeeks: weeks('hdhdhd'),
    });
    const sent = new NotificationBudget()
      .consider(dramaFor(at), at, 0)
      .filter((c) => c.verdict === 'send');
    expect(sent.map((c) => c.moment.id)).toEqual(['title_night']);
  });

  it('rules alone until the window has enough offers to rank', () => {
    const budget = new NotificationBudget();
    expect(budget.thresholdAt(0)).toBe(DEFAULT_NOTIFY_POLICY.weightFloor);
    const at = input({ weekScore: { humans: 3, demons: 2 } });
    budget.consider(dramaFor(at), at, 0);
    expect(budget.thresholdAt(HOUR)).toBe(DEFAULT_NOTIFY_POLICY.weightFloor);
  });
});

describe('the adaptive threshold', () => {
  // A one-day threshold window makes k equal to the daily budget, so the
  // ranking is visible in four offers instead of twenty-one. Same rule.
  const policy = { thresholdWindowMs: DAY, budgetPerDay: 3, weightFloor: 0 };

  it('rises to the k-th best thing the window has seen', () => {
    const budget = new NotificationBudget(policy);
    const ids: MomentId[] = ['record_level', 'season_comeback', 'record_lead', 'title_night'];
    ids.forEach((id, i) => {
      const at = input({ seasonNumber: 500 + i });
      budget.consider(report(id), at, i * HOUR);
    });
    // record_level 9.38, season_comeback 8.62, record_lead 8.38, title 6.99
    // — the third best is record_lead, so that is now the bar.
    expect(budget.thresholdAt(4 * HOUR)).toBeCloseTo(momentWeight('record_lead'), 5);
  });

  it('never drops below the floor', () => {
    const budget = new NotificationBudget({ thresholdWindowMs: DAY, budgetPerDay: 3 });
    (['week_point', 'week_point', 'week_point', 'week_point'] as MomentId[]).forEach((id, i) => {
      const at = input({ seasonNumber: 500 + i });
      budget.consider(report(id), at, i * HOUR);
    });
    expect(budget.thresholdAt(4 * HOUR)).toBe(DEFAULT_NOTIFY_POLICY.weightFloor);
  });

  it('falls back again once the good moments age out of the window', () => {
    const budget = new NotificationBudget(policy);
    (['record_level', 'season_comeback', 'record_lead'] as MomentId[]).forEach((id, i) => {
      budget.consider(report(id), input({ seasonNumber: 500 + i }), i * HOUR);
    });
    expect(budget.thresholdAt(3 * HOUR)).toBeGreaterThan(8);
    // A week later that era is gone, and so is the bar it set — the point
    // of the window. The main channel's record moments did exactly this
    // between Season 1,188 and 1,196.
    expect(budget.thresholdAt(3 * HOUR + 8 * DAY)).toBe(0);
  });
});

describe('spending the budget', () => {
  it('takes the best of several moments landing at once, and holds the rest', () => {
    // A Season decider that is also a comeback and also puts the all-time
    // record on the line: three moments, one instant, one notification.
    const at = input({
      seasonScore: { humans: 3, demons: 3 },
      completedWeeks: weeks('dddhhh'),
      lifetimeRecord: { humans: 100, demons: 101 },
    });
    const candidates = new NotificationBudget().consider(dramaFor(at), at, 0);
    const byId = Object.fromEntries(candidates.map((c) => [c.moment.id, c.verdict]));
    expect(byId).toEqual({
      record_level: 'send',
      season_comeback: 'cooldown',
      season_decider: 'below_threshold',
    });
  });

  it('refuses a fourth send in a day, then allows one when the first ages out', () => {
    const budget = new NotificationBudget();
    const title = (season: number) =>
      input({
        seasonNumber: season,
        weekScore: { humans: 3, demons: 3 },
        seasonScore: { humans: 3, demons: 3 },
        completedNights: nights('hdhdhd'),
        completedWeeks: weeks('hdhdhd'),
      });
    const offer = (season: number, at: number) => {
      const state = title(season);
      return budget.consider(dramaFor(state), state, at)[0].verdict;
    };

    expect(offer(500, 0)).toBe('send');
    expect(offer(501, 6 * HOUR)).toBe('send');
    expect(offer(502, 12 * HOUR)).toBe('send');
    expect(offer(503, 18 * HOUR)).toBe('budget_spent');
    // The ceiling is a trailing window, not a calendar day.
    expect(offer(504, DAY + MINUTE)).toBe('send');
  });

  it('keeps two sends apart', () => {
    const budget = new NotificationBudget();
    const at = (season: number) =>
      input({
        seasonNumber: season,
        weekScore: { humans: 3, demons: 3 },
        seasonScore: { humans: 3, demons: 3 },
        completedNights: nights('hdhdhd'),
        completedWeeks: weeks('hdhdhd'),
      });
    const offer = (season: number, when: number) => {
      const state = at(season);
      return budget.consider(dramaFor(state), state, when)[0].verdict;
    };
    expect(offer(500, 0)).toBe('send');
    expect(offer(501, 10 * MINUTE)).toBe('cooldown');
    expect(offer(502, 40 * MINUTE)).toBe('send');
  });

  it('reports what it has spent', () => {
    const budget = new NotificationBudget();
    const at = input({
      weekScore: { humans: 3, demons: 3 },
      seasonScore: { humans: 3, demons: 3 },
      completedNights: nights('hdhdhd'),
      completedWeeks: weeks('hdhdhd'),
    });
    budget.consider(dramaFor(at), at, 0);
    expect(budget.sentWithin(HOUR).map((s) => s.id)).toEqual(['title_night']);
    expect(budget.sentWithin(2 * DAY)).toEqual([]);
  });
});

describe('carrying its state', () => {
  it('round-trips, so it can be persisted where the sender ends up living', () => {
    const at = input({
      weekScore: { humans: 3, demons: 3 },
      seasonScore: { humans: 3, demons: 3 },
      completedNights: nights('hdhdhd'),
      completedWeeks: weeks('hdhdhd'),
    });
    const first = new NotificationBudget();
    expect(first.consider(dramaFor(at), at, 0)[0].verdict).toBe('send');

    const resumed = new NotificationBudget({}, JSON.parse(JSON.stringify(first.toJSON())));
    // Both the seen key and the cooldown have to survive the trip.
    expect(resumed.consider(dramaFor(at), at, 1000)).toEqual([]);
    const other = input({
      seasonNumber: 501,
      weekScore: { humans: 3, demons: 3 },
      seasonScore: { humans: 3, demons: 3 },
      completedNights: nights('hdhdhd'),
      completedWeeks: weeks('hdhdhd'),
    });
    expect(resumed.consider(dramaFor(other), other, 1000)[0].verdict).toBe('cooldown');
  });
});
