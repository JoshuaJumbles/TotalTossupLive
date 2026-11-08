import { describe, expect, it } from 'vitest';
import type { SeasonSummary, Side } from '@total-tossup-live/shared';
import {
  HISTORY_LENGTH,
  pushSeason,
  cameBackFrom,
  seasonScoreOf,
  seasonWinnerOf,
  seasonWonFromBrink,
  seasonsSince,
  wasSweep,
  wentTheDistance,
} from '@total-tossup-live/shared';

// Here rather than in shared/ for the same reason the other shared-module
// suites are: shared/ has no test runner of its own.

/** A Season from a Week-order string: 'hhdhh' is Humans, Humans, Demons,
 * Humans, Humans. Production shape unless a test says otherwise. */
function season(pattern: string, over: Partial<SeasonSummary> = {}): SeasonSummary {
  return {
    seasonNumber: 1200,
    weeks: [...pattern].map((c) => (c === 'h' ? 'humans' : 'demons') as Side),
    weeksPerSeason: 7,
    endedAt: 0,
    record: { humans: 601, demons: 597 },
    streak: { side: 'humans', length: 1 },
    ...over,
  };
}

describe('reading a Season back', () => {
  it('counts the final score off the Week order', () => {
    expect(seasonScoreOf(season('hhdhdh'))).toEqual({ humans: 4, demons: 2 });
  });

  it('takes the winner from the last Week', () => {
    // Not from the majority, though they agree — a Season stops the moment
    // it is clinched and never plays a dead Week, so the clinching Week is
    // always the last entry. Relied on rather than stored.
    expect(seasonWinnerOf(season('hhdhdh'))).toBe('humans');
    expect(seasonWinnerOf(season('ddhdd'))).toBe('demons');
  });

  it('knows a Season that ran to its last Week', () => {
    expect(wentTheDistance(season('hhhdddh'))).toBe(true);
    expect(wentTheDistance(season('hhhdh'))).toBe(false);
  });

  it('knows a sweep, and does not call a short Season one', () => {
    expect(wasSweep(season('hhhh'))).toBe(true);
    expect(wasSweep(season('hhhdh'))).toBe(false);
    // A Season with no Weeks at all isn't a sweep by every side at once.
    expect(wasSweep(season(''))).toBe(false);
  });

  it('finds a Season won from the brink', () => {
    // The whole point of keeping the ring: 0-3 down in a best-of-7, then
    // four straight.
    expect(seasonWonFromBrink(season('dddhhhh'))).toBe('humans');
    expect(seasonWonFromBrink(season('hhhdddd'))).toBe('demons');
    // Down 0-3 and lost anyway. Three Weeks back is not a comeback, and
    // this is the case that stops the criterion from meaning "was close".
    expect(seasonWonFromBrink(season('hhhdddh'))).toBeNull();
    expect(seasonWonFromBrink(season('hhdhdh'))).toBeNull();
  });

  it('is not the live predicate, which cannot answer this at all', () => {
    // Why there are two functions. cameBackFrom asks whether a side has
    // drawn *level* from the brink, which is the right question about a
    // Season still being played and unanswerable about one that has
    // closed: the side that came back and won is ahead, not level. Asked
    // of a finished Season it returns null every single time, including
    // for the best Season the game can produce.
    const brinkAndWon = season('dddhhhh');
    expect(cameBackFrom(brinkAndWon.weeks, 3)).toBeNull();
    expect(seasonWonFromBrink(brinkAndWon)).toBe('humans');
    // Mid-Season, level from 0-3, is exactly what it is for.
    expect(cameBackFrom([...'dddhhh'].map((c) => (c === 'h' ? 'humans' : 'demons') as Side), 3)).toBe(
      'humans',
    );
  });
});

describe('the ring', () => {
  it('keeps the newest and drops the oldest past its length', () => {
    let history: SeasonSummary[] = [];
    for (let i = 1; i <= HISTORY_LENGTH + 5; i += 1) {
      history = pushSeason(history, season('hhhh', { seasonNumber: i }));
    }
    expect(history).toHaveLength(HISTORY_LENGTH);
    expect(history[0].seasonNumber).toBe(6);
    expect(history[history.length - 1].seasonNumber).toBe(HISTORY_LENGTH + 5);
  });

  it('does not mutate what it was given', () => {
    const history = [season('hhhh', { seasonNumber: 1 })];
    pushSeason(history, season('dddd', { seasonNumber: 2 }));
    expect(history).toHaveLength(1);
  });

  it('selects strictly after the Season asked for', () => {
    const history = [1198, 1199, 1200].map((seasonNumber) => season('hhhh', { seasonNumber }));
    expect(seasonsSince(history, 1198).map((s) => s.seasonNumber)).toEqual([1199, 1200]);
    // Strictly: the Season the viewer watched finish is not news.
    expect(seasonsSince(history, 1200)).toEqual([]);
    expect(seasonsSince(history, 0)).toHaveLength(3);
  });
});
