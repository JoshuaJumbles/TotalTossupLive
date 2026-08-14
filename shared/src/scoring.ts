/**
 * Container-size math for the Night→Week→Season point escalation.
 *
 * A container of size N (Nights/Week, or Weeks/Season) awards position `p`
 * (1-indexed) exactly `p` points to whichever side wins it. The final split
 * is some subset of {1..N} for one side and the complement for the other —
 * a tie is possible exactly when some subset of {1..N} sums to half the
 * total pool T(N) = N(N+1)/2.
 *
 * If T(N) is odd, T(N)/2 isn't an integer, so no subset can ever equal it —
 * a tie is structurally impossible regardless of which positions either
 * side wins. T(N) is odd iff N ≡ 1 or 2 (mod 4).
 *
 * Valid container sizes: 1, 2, 5, 6, 9, 10, 13, 14, ... (not 3, 4, 7, 8, ...)
 */

export function triangular(n: number): number {
  return (n * (n + 1)) / 2;
}

export function isValidContainerSize(n: number): boolean {
  return Number.isInteger(n) && n > 0 && (n % 4 === 1 || n % 4 === 2);
}

/** Points awarded for winning position `position` (1-indexed) in a container. */
export function pointValueForPosition(position: number): number {
  return position;
}

export type Side = 'humans' | 'demons';

export interface ContainerScore {
  humans: number;
  demons: number;
}

export function emptyScore(): ContainerScore {
  return { humans: 0, demons: 0 };
}

export function addPoints(score: ContainerScore, side: Side, points: number): ContainerScore {
  return { ...score, [side]: score[side] + points };
}

/**
 * Given a container is fully decided (all `totalPositions` positions have
 * been played), returns the winner. Relies on isValidContainerSize(totalPositions)
 * having been enforced at config time — otherwise a tie is possible and this
 * will incorrectly report `null`.
 */
export function containerWinner(score: ContainerScore): Side | null {
  if (score.humans === score.demons) return null;
  return score.humans > score.demons ? 'humans' : 'demons';
}

/** One completed Week's outcome within a Season — accumulated on
 * ChannelSnapshot.completedWeeks for the Season Overview screen's
 * week-by-week tally. Reset at each new Season, unlike lifetimeRecord
 * (which has no tie-proof guarantee — independent seasons can be 1-1). */
export interface WeekResult {
  weekNumber: number;
  winner: Side;
}

/** Consecutive Seasons won by `side` — distinct from lifetimeRecord, which
 * is just a running tally and can't answer "how many *in a row*" on its
 * own. `side: null` only before any Season has ever completed on this
 * channel (length is then meaningless and always 0). Updated once, at the
 * same moment lifetimeRecord is (a Season closing): same winner as last
 * time extends it, a new winner resets it to 1. */
export interface SeasonStreak {
  side: Side | null;
  length: number;
}

export function emptyStreak(): SeasonStreak {
  return { side: null, length: 0 };
}
