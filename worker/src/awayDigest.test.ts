import { describe, expect, it } from 'vitest';
import type { DigestPoint } from '@total-tossup-live/shared';
import { digestBetween, digestLines } from '@total-tossup-live/shared';
import { digestResponseFor, readDigestRequest } from './awayDigest';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** The same mid-Season shape digest.test.ts uses, so a reader comparing
 * the two suites is comparing the route and not the fixtures. */
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

/** A Season closed against the Humans, ending the 5-Season run they were
 * on. `streak_broken` is 2.0 a day, so this headline survives a short
 * absence and is gated out of a long one — which is what makes it the
 * right event for testing whose clock the absence is measured on. */
const runBroken = {
  was: point({ seasonStreak: { side: 'humans', length: 5 } }),
  now: {
    seasonNumber: 1198,
    weekNumber: 1,
    nightsPerWeek: 7,
    weeksPerSeason: 7,
    weekScore: { humans: 0, demons: 0 },
    seasonScore: { humans: 0, demons: 0 },
    completedWeeks: [],
    lifetimeRecord: { humans: 601, demons: 596 },
    seasonStreak: { side: 'demons' as const, length: 1 },
  },
};

describe('answering with a digest', () => {
  it('is the same answer the client would have computed itself', () => {
    // The whole justification for the route: one model, two ways of
    // reaching it. If this ever diverges, the route is lying.
    const { was: then, now } = runBroken;
    const response = digestResponseFor({ lastSeen: then, awayMs: 30 * MINUTE }, now, []);
    const direct = digestBetween(then, { ...now, seenAt: 30 * MINUTE });

    expect(response.digest).toEqual(direct);
    expect(response.lines).toEqual(digestLines(direct!));
  });

  it('sends the copy as well as the structure', () => {
    // A client should need no words of its own. The structure rides along
    // because a card colours a headline by side.
    const { was: then, now } = runBroken;
    const { lines, digest } = digestResponseFor({ lastSeen: then, awayMs: 30 * MINUTE }, now, []);

    expect(lines?.title).toBe('While you were away — 30m');
    expect(lines?.headlines).toEqual(["Humans' 5-Season run is over"]);
    expect(digest?.headlines[0].side).toBe('humans');
  });

  it('declines, without an empty shell to render', () => {
    // digestBetween returning null is the common answer, and the route
    // has to pass that through as nothing rather than as a card with no
    // headlines in it.
    const then = point();
    const response = digestResponseFor({ lastSeen: then, awayMs: 90 * 1000 }, point(), []);
    expect(response).toEqual({ digest: null, lines: null });
  });
});

describe('whose clock the absence is measured on', () => {
  it('is the client\'s, not the coordinator\'s', () => {
    // The point of sending awayMs. Here the stored point is three days
    // old — a device that was switched off, or a clock three days out —
    // but the viewer was only away half an hour. Measuring from the
    // server's present would put the absence past the expectation gate
    // (streak_broken is 2.0 a day, so anything over twelve hours) and
    // silently drop the one headline there was.
    const { was: then, now } = runBroken;
    const stale = { ...then, seenAt: Date.now() - 3 * DAY };

    const reported = digestResponseFor({ lastSeen: stale, awayMs: 30 * MINUTE }, now, []);
    expect(reported.digest?.headlines.map((h) => h.id)).toEqual(['streak_broken']);

    // And the same request with the absence it would have been given if
    // the server had stamped its own now, to show the gate really is
    // what would have bitten.
    const assumed = digestResponseFor({ lastSeen: stale, awayMs: 3 * DAY }, now, []);
    expect(assumed.digest?.headlines ?? []).toEqual([]);
  });

  it('falls back to the server clock when the client sends none', () => {
    const then = point({ seenAt: 1_000_000 });
    const request = readDigestRequest({ lastSeen: then }, 1_000_000 + 2 * HOUR);
    expect(request?.awayMs).toBe(2 * HOUR);
  });

  it('is clamped, because it is the one number a client can skew', () => {
    const then = point({ seenAt: 1_000 });
    expect(readDigestRequest({ lastSeen: then, awayMs: -5 }, 0)?.awayMs).toBe(0);
    expect(readDigestRequest({ lastSeen: then, awayMs: 1e18 }, 0)?.awayMs).toBe(365 * DAY);
    // A clock that ran backwards makes the fallback negative too.
    expect(readDigestRequest({ lastSeen: then }, 0)?.awayMs).toBe(0);
    // NaN and Infinity reach the clamp as a missing value, not as a gap.
    expect(readDigestRequest({ lastSeen: then, awayMs: NaN }, 1_000 + HOUR)?.awayMs).toBe(HOUR);
  });
});

describe('reading a point a client stored', () => {
  it('takes the shape the current app writes', () => {
    expect(readDigestRequest({ lastSeen: point(), awayMs: HOUR }, 0)).not.toBeNull();
  });

  it('refuses a shape it cannot do arithmetic on', () => {
    // Not a security boundary — nothing here is worth attacking. These
    // are the values an older build of the app could be carrying on disk,
    // and each one would otherwise be a 500 from inside the Durable
    // Object instead of a 400 the client can recover from.
    const cases: Record<string, unknown> = {
      'not an object': 'hello',
      'no point at all': {},
      'a null point': { lastSeen: null },
      'a string seenAt': { lastSeen: { ...point(), seenAt: '0' } },
      'no all-time record': { lastSeen: { ...point(), lifetimeRecord: undefined } },
      'half an all-time record': { lastSeen: { ...point(), lifetimeRecord: { humans: 601 } } },
      'no Week order': { lastSeen: { ...point(), completedWeeks: undefined } },
      'a Week order that is not a list': { lastSeen: { ...point(), completedWeeks: {} } },
      'no run': { lastSeen: { ...point(), seasonStreak: undefined } },
      'no Season number': { lastSeen: { ...point(), seasonNumber: undefined } },
    };

    for (const [why, body] of Object.entries(cases)) {
      expect(readDigestRequest(body, 0), why).toBeNull();
    }
  });

  it('keeps a point carrying fields it does not know about', () => {
    // The forward-compatibility half. A client stores its whole snapshot
    // and snapshots grow, so a point with extra keys is the normal case
    // and must not be refused.
    const body = { lastSeen: { ...point(), somethingNew: 'from a later build' } };
    expect(readDigestRequest(body, 0)).not.toBeNull();
  });
});
