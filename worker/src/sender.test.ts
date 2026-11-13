import { describe, expect, it } from 'vitest';
import type { DramaInput, DramaReport, MomentId } from '@total-tossup-live/shared';
import { MOMENT_RATES_PER_DAY, MOMENT_SCOPES, NotificationBudget, momentWeight } from '@total-tossup-live/shared';
import type { ApnsAlert, ApnsOutcome } from './apns';
import type { DeviceRegistration } from './devices';
import { deliver, sendsFor, type PendingSend } from './sender';

const MINUTE = 60 * 1000;

/** The same baseline notify.test.ts and drama.test.ts use — a settled
 * all-time record, because a level one makes record_lead fire on
 * everything and bury whatever a test is about. */
function input(over: Partial<DramaInput> = {}): DramaInput {
  return {
    phase: 'flipping',
    seasonNumber: 1218,
    weekNumber: 4,
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

function report(...ids: MomentId[]): DramaReport {
  const moments = ids
    .map((id) => ({ id, weight: momentWeight(id), side: null }))
    .sort((a, b) => b.weight - a.weight);
  return { moments, score: moments[0]?.weight ?? 0 };
}

const device = (over: Partial<DeviceRegistration> = {}): DeviceRegistration => ({
  token: 'a'.repeat(64),
  environment: 'sandbox',
  topic: 'live.totaltossup.TotalTossup',
  registeredAt: 0,
  ...over,
});

describe('turning an approved moment into a push', () => {
  it('carries the copy the rest of the project already wrote', () => {
    // No wording of its own. If a notification ever reads differently
    // from the web banner about the same moment, dramaCopy stopped being
    // the single source and this is where it broke.
    const budget = new NotificationBudget();
    const { sends } = sendsFor(budget, report('title_night'), input(), 0, 'main');

    expect(sends).toHaveLength(1);
    expect(sends[0].alert.title).toBe('Winner takes the Season');
    expect(sends[0].alert.body).toContain('Season 1,218');
    expect(sends[0].momentId).toBe('title_night');
  });

  it('sends nothing for a moment the budget turned down', () => {
    // week_point is 127 a day and 1.65 bits — the single most common
    // thing drama.ts detects, and the exact thing the floor exists to
    // keep off a lock screen.
    const budget = new NotificationBudget();
    const { sends, candidates } = sendsFor(budget, report('week_point'), input(), 0, 'main');

    expect(sends).toEqual([]);
    expect(candidates.map((c) => c.verdict)).toEqual(['below_threshold']);
  });

  it('stacks everything about one channel together', () => {
    const budget = new NotificationBudget();
    const { sends } = sendsFor(budget, report('title_night'), input(), 0, 'main');
    expect(sends[0].alert.threadId).toBe('channel:main');
  });

  it('tells the app what it is about, for a tap to act on', () => {
    const budget = new NotificationBudget();
    const { sends } = sendsFor(budget, report('title_night'), input(), 0, 'main');
    expect(sends[0].alert.data).toMatchObject({
      channelId: 'main',
      momentId: 'title_night',
      seasonNumber: 1218,
      weekNumber: 4,
    });
  });
});

describe('when a notification stops being worth delivering', () => {
  it('expires with the container the moment is about', () => {
    // The judgement this module adds. Everything pushed here is
    // prospective — an invitation to watch something — so one delivered
    // after the thing finished is wrong rather than late.
    const budget = new NotificationBudget();
    const now = 1_000_000;

    // title_night is about the Night on now — three minutes, because a
    // Night is 2.6 and an invitation to watch one is worthless after it.
    const night = sendsFor(budget, report('title_night'), input(), now, 'main');
    expect(night.sends[0].expiresAt).toBe(now + 3 * MINUTE);

    // season_comeback is named for the Season and scoped to the Week —
    // it stays true across that Week's Nights, so it gets the Week's
    // fifteen. Worth asserting rather than assuming: the name says
    // Season and the scope says Week, and reading the name is how this
    // test was wrong the first time it was written.
    const week = sendsFor(new NotificationBudget(), report('season_comeback'), input(), now, 'main');
    expect(week.sends[0].expiresAt).toBe(now + 15 * MINUTE);
  });

  it('gives every moment a lifetime, including the one that never sends', () => {
    // milestone_season is the only season-scoped moment and it is held
    // below the floor on purpose (predictable isn't surprising), so the
    // 90-minute window has no send to test through. Checked directly so
    // that a new season-scoped criterion doesn't arrive to find the
    // longest window untested.
    expect(MOMENT_SCOPES.milestone_season).toBe('season');
    expect(Object.keys(MOMENT_SCOPES).every((id) => id in MOMENT_RATES_PER_DAY)).toBe(true);
  });
});

describe('fanning out', () => {
  const pending = (): PendingSend[] => [
    {
      key: 'k',
      momentId: 'title_night',
      alert: { title: 't', body: 'b', threadId: 'channel:main', data: {} } satisfies ApnsAlert,
      expiresAt: 0,
    },
  ];

  it('reaches every registered device', async () => {
    const seen: string[] = [];
    const result = await deliver(
      pending(),
      [device({ token: 'a'.repeat(64) }), device({ token: 'b'.repeat(64) })],
      async (target) => {
        seen.push(target.token);
        return { status: 'sent' };
      },
    );
    expect(seen).toHaveLength(2);
    expect(result.sent).toBe(2);
  });

  it('does not let one dead token cost the others their notification', async () => {
    const dead = 'd'.repeat(64);
    const result = await deliver(
      pending(),
      [device({ token: dead }), device({ token: 'c'.repeat(64) })],
      async (target) =>
        target.token === dead ? { status: 'unregistered' } : { status: 'sent' },
    );

    expect(result.sent).toBe(1);
    expect(result.retire).toEqual([dead]);
  });

  it('reports a dead device once however many pushes were in flight', async () => {
    // Three approved moments at the same instant means three attempts
    // per device, and a dead one says so three times. Retiring it once
    // is enough, and a duplicated token would be removed twice from a
    // list it is no longer in.
    const dead = 'd'.repeat(64);
    const three = [pending()[0], { ...pending()[0], key: 'k2' }, { ...pending()[0], key: 'k3' }];
    const result = await deliver(three, [device({ token: dead })], async () => ({
      status: 'unregistered',
    }));
    expect(result.retire).toEqual([dead]);
  });

  it('survives a send that throws rather than returning', async () => {
    // Apple unreachable, DNS gone, whatever. A notification is a
    // courtesy and the channel is the product.
    const result = await deliver(pending(), [device()], async () => {
      throw new Error('network down');
    });
    expect(result.sent).toBe(0);
    expect(result.failures[0]).toMatchObject({ code: 0, reason: 'network down' });
  });

  it('does nothing, cheaply, when nobody has registered', async () => {
    let asked = false;
    const result = await deliver(pending(), [], async () => {
      asked = true;
      return { status: 'sent' };
    });
    expect(asked).toBe(false);
    expect(result).toEqual({ sent: 0, retire: [], failures: [] });
  });

  it('spends the budget even with no credential, which is the point', async () => {
    // The decision path has to run before the key exists, so that the
    // rate can be measured and the copy read on a real device. An
    // unconfigured send is not a failure.
    const result = await deliver(pending(), [device()], async (): Promise<ApnsOutcome> => ({
      status: 'unconfigured',
    }));
    expect(result.failures).toEqual([]);
    expect(result.retire).toEqual([]);
    expect(result.sent).toBe(0);
  });
});
