import { describe, expect, it } from 'vitest';
import { emptyScore, isContainerDecided, isValidContainerSize } from '@total-tossup-live/shared';

// Best-of scoring's own two load-bearing pure functions -- everything
// else in the Night/Week/Season chain (channelDurableObject.ts's
// resolveFlip) is just wiring these two together with addPoints/
// containerWinner, which were already correct and unchanged. Worth
// locking these down directly since a bug in either one breaks every
// channel's container math at once.
describe('isValidContainerSize', () => {
  it('accepts any positive odd integer', () => {
    for (const n of [1, 3, 5, 7, 9, 11, 13]) {
      expect(isValidContainerSize(n)).toBe(true);
    }
  });

  it('rejects even integers -- a best-of race needs a majority to be reachable at all', () => {
    for (const n of [0, 2, 4, 6, 8]) {
      expect(isValidContainerSize(n)).toBe(false);
    }
  });

  it('rejects non-positive and non-integer values', () => {
    expect(isValidContainerSize(-3)).toBe(false);
    expect(isValidContainerSize(0)).toBe(false);
    expect(isValidContainerSize(2.5)).toBe(false);
  });
});

describe('isContainerDecided', () => {
  it('is false while both sides are short of a majority of a best-of-7', () => {
    expect(isContainerDecided({ ...emptyScore(), humans: 3, demons: 3 }, 7)).toBe(false);
    expect(isContainerDecided({ ...emptyScore(), humans: 3, demons: 0 }, 7)).toBe(false);
  });

  it("fires the moment either side exceeds half of 7 -- best-of's own early stop", () => {
    expect(isContainerDecided({ ...emptyScore(), humans: 4, demons: 0 }, 7)).toBe(true);
    expect(isContainerDecided({ ...emptyScore(), humans: 4, demons: 3 }, 7)).toBe(true);
    expect(isContainerDecided({ ...emptyScore(), humans: 0, demons: 4 }, 7)).toBe(true);
  });

  it('scales with container size -- a best-of-3 decides at 2, not 4', () => {
    expect(isContainerDecided({ ...emptyScore(), humans: 1, demons: 1 }, 3)).toBe(false);
    expect(isContainerDecided({ ...emptyScore(), humans: 2, demons: 0 }, 3)).toBe(true);
    expect(isContainerDecided({ ...emptyScore(), humans: 2, demons: 1 }, 3)).toBe(true);
  });
});
