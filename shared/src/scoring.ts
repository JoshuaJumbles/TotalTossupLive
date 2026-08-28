/**
 * Container-size math for the Night→Week→Season best-of race.
 *
 * A container of size N (Nights/Week, or Weeks/Season) is a flat best-of-N:
 * every position won is worth exactly 1 point, and the container ends the
 * moment either side has secured a strict majority — more than N/2 — rather
 * than waiting for all N positions to be played (see isContainerDecided).
 * This is Josh's own pivot away from the original triangular-weighted
 * design (position `p` worth `p` points, decided only once every position
 * had played): that shape guaranteed the whole sheet got used, but it also
 * meant most of a 6-position container was mechanically "dead" right up
 * until the last one or two positions actually decided anything. Best-of
 * trades that guarantee for two things Josh wanted more: no dead
 * positions (every one can end it), and no special rules to explain (any
 * odd N just needs a majority, full stop).
 *
 * Tie-proofing an odd N is immediate: N/2 is never an integer, so no
 * split of N positions between two sides can ever land exactly on it —
 * one side always ends up with a strict majority once all N are played,
 * and often before that.
 *
 * Valid container sizes: 1, 3, 5, 7, 9, 11, ... (any positive odd N).
 */

export function isValidContainerSize(n: number): boolean {
  return Number.isInteger(n) && n > 0 && n % 2 === 1;
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

/** True once one side already holds a strict majority of a size-`n`
 * container's positions — the container is decided, whether or not every
 * position has actually been played yet. This is the "best-of" early
 * stop: a Week can end on Night 4 of 7 just as easily as Night 7, since
 * the remaining Nights could no longer change the outcome. */
export function isContainerDecided(score: ContainerScore, n: number): boolean {
  return score.humans > n / 2 || score.demons > n / 2;
}

/**
 * Given a container is fully decided (isContainerDecided is true, whether
 * that's because every position has been played or a majority landed
 * early), returns the winner. Relies on isValidContainerSize(n) having
 * been enforced at config time — otherwise a tie is possible and this
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
