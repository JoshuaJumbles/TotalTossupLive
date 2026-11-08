import type { DramaInput, DramaMoment, DramaReport, MomentId } from './drama';

/**
 * Deciding which of the Season's dramatic moments is actually worth a
 * phone buzzing.
 *
 * drama.ts answers "what is at stake right now", and answers it on every
 * broadcast — which during `flipping` is every two seconds. A sender built
 * straight on top of that would notify about one deciding Night roughly
 * seventy-five times. So this module adds the two things that turn a
 * continuous score into a handful of notifications a day:
 *
 *  1. Occurrence identity, so a moment that stays true for fifteen minutes
 *     is one event rather than four hundred.
 *  2. A ranked budget, so the moments that do get sent are the best few
 *     and not merely the first few.
 *
 * The budget is the part worth being careful about, because it's the only
 * promise made to someone who installs this: adding a criterion should
 * change *what wins*, never *how often their phone goes off*. That rules
 * out the obvious design — a set of booleans, each of which sends — and it
 * also rules out a fixed daily quota that has to be spent, which would
 * manufacture drama on a quiet day. What's here is a ceiling plus a
 * standard: at most `budgetPerDay` sends, and only for moments that clear
 * the bar. Some days it sends nothing. That's the correct behaviour when
 * nothing happened.
 */

/**
 * Which container a moment belongs to — and therefore how long it lasts
 * and what counts as the same one happening again.
 *
 * A Week match point is about the Night now in progress: it resolves
 * tonight, one way or the other. A side being one Week from the Season is
 * about this Week, and stays true across all of its Nights. A round-
 * numbered Season is about the Season.
 */
export type MomentScope = 'season' | 'week' | 'night';

export const MOMENT_SCOPES: Record<MomentId, MomentScope> = {
  week_point: 'night',
  week_decider: 'night',
  week_sweep_watch: 'night',
  week_comeback: 'night',
  title_night: 'night',

  season_point: 'week',
  season_decider: 'week',
  season_sweep_watch: 'week',
  season_comeback: 'week',
  streak_on_line: 'week',
  record_level: 'week',
  record_lead: 'week',

  milestone_season: 'season',
};

/**
 * A stable name for one occurrence of a moment — the same string on every
 * broadcast it stays live for, and a different one the next time it comes
 * around.
 *
 * Positions are counted from the scores rather than read off
 * nightNumber/weekNumber, which looks like the long way round and isn't.
 * The coordinator updates a container's score the instant it changes
 * (resolveFlip) but only advances the counter when the next one starts
 * (beginNextStep), so between those two points the snapshot reads 3-3 on
 * Nights while nightNumber still names the Night that just finished. Key
 * off the counter and every moment fires twice — once in the night_won
 * pause and once again when the deciding Night begins.
 *
 * Counting played positions instead makes the key a function of exactly
 * the state that made the moment true, so the two can't come apart. The
 * side is folded in for the same reason: two sides can't hold the same
 * one-sided moment at once today, but nothing here should depend on that.
 */
export function occurrenceKey(moment: DramaMoment, input: DramaInput): string {
  const season = `S${input.seasonNumber}`;
  const weeksPlayed = input.seasonScore.humans + input.seasonScore.demons;
  const nightsPlayed = input.weekScore.humans + input.weekScore.demons;
  const who = moment.side ?? 'both';

  switch (MOMENT_SCOPES[moment.id]) {
    case 'season':
      return `${moment.id}/${who}/${season}`;
    case 'week':
      return `${moment.id}/${who}/${season}W${weeksPlayed + 1}`;
    case 'night':
      return `${moment.id}/${who}/${season}W${weeksPlayed + 1}N${nightsPlayed + 1}`;
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

export interface NotifyPolicy {
  /** The ceiling on sends in any trailing `capWindowMs`. Not a quota — a
   * day with nothing above the bar sends nothing. */
  budgetPerDay: number;
  /** The window the ceiling is counted over. */
  capWindowMs: number;
  /** The window the adaptive threshold estimates its distribution from.
   * Deliberately much longer than the cap window: the ceiling wants to
   * know "how many did this phone get today", the threshold wants a stable
   * picture of what a good moment looks like around here. */
  thresholdWindowMs: number;
  /** The shortest gap between two sends. Mostly there to collapse moments
   * that land on the same instant. */
  cooldownMs: number;
  /**
   * The weight below which nothing sends, however quiet it's been.
   *
   * This is the designed answer and the adaptive threshold is only its
   * correction, so it's worth saying where the number comes from. Summing
   * MOMENT_RATES_PER_DAY over everything at or above 6.5 bits gives 2.98
   * occurrences a day — a title Night, a Season comeback, and the two
   * record moments. That is the budget, near enough exactly, which is a
   * coincidence of the table rather than a derivation from it, but a
   * convenient one. 6.5 also falls in open space: the nearest moments are
   * a title Night at 6.99 and a Week comeback at 6.10, so the cut isn't
   * balanced on top of a value where a small re-measurement would flip it.
   *
   * Its real job is the quiet channel. Without a floor, a sender on a
   * channel where nothing good ever happens would work out that a Week
   * match point is the best thing all day and dutifully send three of
   * those, which is the exact failure the ranking was meant to prevent.
   */
  weightFloor: number;
}

/**
 * What these numbers actually do, measured by running this selector over
 * 1,500–2,000 simulated days of the main preset rather than reasoned about:
 *
 *   sends/day   1.57        ceiling refused 0.43/day, cooldown 0.15/day
 *   days silent 15.8%       one 30.7%, two 33.9%, three 19.5%, four never
 *
 * Three things in that are worth knowing before changing anything here.
 *
 * The budget is a ceiling and the realised rate sits well under it. That
 * is the intended shape — a quiet day should be quiet — but it means
 * "3 a day" describes the worst case, not the experience. The live channel
 * currently runs hotter than the long-run figure because the all-time
 * record is close enough for the two record criteria to be in play at all,
 * and those are the rarest things in the table.
 *
 * The floor is the only real knob, and it has very little travel. Dropping
 * it from 6.5 to 6.0 adds the Week comeback and three criteria's worth of
 * supply, and moves sends from 1.57 to 2.23 — because past that point the
 * quantile takes over and clamps the rest. Which is the promise working:
 * supply went up four-fold and the phone got 40% busier. Raising it to 7.0
 * loses the title Night and collapses to 0.51/day. 6.5 is the midpoint of
 * the gap between a title Night at 6.99 bits and a Week comeback at 6.10,
 * so it isn't balanced on a value.
 *
 * At 6.0 the ceiling refuses 2.20/day against 2.23 sent — arrival order
 * would be deciding half of what gets through, which is what the ranking
 * was built to avoid. At 6.5 it refuses 0.43 against 1.57, so the ceiling
 * is a safety net rather than a gate. That ratio is the thing to watch if
 * these are ever retuned.
 */
export const DEFAULT_NOTIFY_POLICY: NotifyPolicy = {
  budgetPerDay: 3,
  capWindowMs: DAY_MS,
  thresholdWindowMs: 7 * DAY_MS,
  cooldownMs: 30 * 60 * 1000,
  weightFloor: 6.5,
};

/** Why a candidate did or didn't send. The three refusals are ordered
 * worst-reason-last on purpose — see `consider`. */
export type NotifyVerdict = 'send' | 'below_threshold' | 'cooldown' | 'budget_spent';

export interface NotifyCandidate {
  /** Its occurrence key, so a log can be de-duplicated after the fact. */
  key: string;
  moment: DramaMoment;
  at: number;
  verdict: NotifyVerdict;
  /** The bar it was held to, for a log that has to explain itself later. */
  threshold: number;
}

interface Offer {
  at: number;
  weight: number;
}

interface Sent {
  at: number;
  weight: number;
  id: MomentId;
  key: string;
}

export interface NotifyBudgetState {
  seen: Record<string, number>;
  offered: Offer[];
  sent: Sent[];
}

/**
 * One channel's share of someone's attention.
 *
 * Stateful, unavoidably: what it holds is a log of what has already been
 * offered and sent, and no amount of cleverness derives that from the
 * current snapshot. That makes it the one thing in this project that has
 * to be remembered rather than recomputed, which is reason enough to keep
 * it small, serialisable, and outside the Durable Object's own snapshot.
 */
export class NotificationBudget {
  readonly policy: NotifyPolicy;
  private seen: Map<string, number>;
  private offered: Offer[];
  private sent: Sent[];

  constructor(policy: Partial<NotifyPolicy> = {}, state?: NotifyBudgetState) {
    this.policy = { ...DEFAULT_NOTIFY_POLICY, ...policy };
    this.seen = new Map(Object.entries(state?.seen ?? {}));
    this.offered = [...(state?.offered ?? [])];
    this.sent = [...(state?.sent ?? [])];
  }

  /**
   * Put a report's moments to the budget and return a verdict for each one
   * being seen for the first time. Moments already offered are silently
   * dropped — they're the same event, still running.
   *
   * `report.moments` arrives sorted by weight, and nothing here re-sorts
   * it, which is what makes a tie break correctly: when several moments
   * become live on the same instant, the best one is offered first and
   * takes the send, and the cooldown turns the rest away.
   *
   * A moment is marked seen whether or not it sends, so one turned away
   * for a cooldown doesn't come back a second later asking again. The
   * consequence is that a moment which becomes live during a cooldown is
   * lost rather than queued, and that's the right trade for a
   * notification: by the time there's room, the Night it was about is over.
   */
  consider(report: DramaReport, input: DramaInput, now: number): NotifyCandidate[] {
    this.prune(now);
    const threshold = this.thresholdAt(now);
    const verdicts: NotifyCandidate[] = [];

    for (const moment of report.moments) {
      const key = occurrenceKey(moment, input);
      if (this.seen.has(key)) continue;
      this.seen.set(key, now);
      this.offered.push({ at: now, weight: moment.weight });

      const verdict = this.rule(moment, now, threshold);
      if (verdict === 'send') {
        this.sent.push({ at: now, weight: moment.weight, id: moment.id, key });
      }
      verdicts.push({ key, moment, at: now, verdict, threshold });
    }

    return verdicts;
  }

  /**
   * Accept a report as already-accounted-for: mark its moments seen
   * without offering them to the budget.
   *
   * What this is for is the first snapshot a sender ever sees. A moment is
   * only news if you watched it begin — arriving in the middle of a
   * deciding Night and announcing it is both a lie about the timing and,
   * on a sender that has just restarted, a second notification about
   * something already sent. So whatever is live at startup is taken as
   * history: it counts towards nothing, sends nothing, and the next
   * genuinely new occurrence is the first thing considered.
   *
   * The cost is one missed moment per restart, which is the right side to
   * err on. Reconnects don't need this — the keys from before the drop are
   * still in the seen set.
   */
  prime(report: DramaReport, input: DramaInput, now: number): void {
    for (const moment of report.moments) {
      this.seen.set(occurrenceKey(moment, input), now);
    }
  }

  /**
   * The gates, in the order that makes a log readable.
   *
   * Quality is asked first so that `cooldown` and `budget_spent` only ever
   * appear against moments that genuinely deserved to send. That turns the
   * counts into the diagnostic worth having: if the ceiling is routinely
   * the thing refusing good moments, the threshold is set too low and is
   * spending the budget on worse ones earlier in the day.
   */
  private rule(moment: DramaMoment, now: number, threshold: number): NotifyVerdict {
    if (moment.weight < threshold) return 'below_threshold';
    const last = this.sent[this.sent.length - 1];
    if (last && now - last.at < this.policy.cooldownMs) return 'cooldown';
    const spent = this.sent.filter((s) => now - s.at < this.policy.capWindowMs).length;
    if (spent >= this.policy.budgetPerDay) return 'budget_spent';
    return 'send';
  }

  /**
   * The bar right now: the floor, or the weight of the k-th best thing
   * offered in the threshold window, whichever is higher — where k is how
   * many sends that window is worth at the budgeted rate.
   *
   * It's the "would this have made the cut?" test, asked against the
   * recent past instead of against a table authored once. That matters
   * because the table can't stay true: the two record criteria only exist
   * while the all-time record happens to be close, and the main channel
   * has just left one of those eras — 594-593 last night, 600-595 this
   * morning. A fixed bar would quietly go on waiting for moments that
   * can't occur. This one notices the distribution has moved and spends
   * the budget on whatever is now the best the channel has to offer,
   * provided it still clears the floor.
   *
   * Until the window holds k offers the floor rules alone, which on a new
   * channel means the first week runs on the designed answer.
   *
   * Worth being straight about: on the main channel as it stands today
   * this does nothing. Only about fifteen things a week clear the floor,
   * so the 21st-best is below it and the floor wins every time. The
   * quantile is not earning its place on today's criteria — it's there for
   * the next ones. Add half a dozen rare criteria and the floor alone
   * would quietly take the rate to five or six a day; this is what holds
   * it at the budget and makes the new criteria compete with the old ones
   * instead of adding to them.
   */
  thresholdAt(now: number): number {
    const { thresholdWindowMs, capWindowMs, budgetPerDay, weightFloor } = this.policy;
    const k = Math.max(1, Math.round((budgetPerDay * thresholdWindowMs) / capWindowMs));
    const weights = this.offered
      .filter((offer) => now - offer.at < thresholdWindowMs)
      .map((offer) => offer.weight)
      .sort((a, b) => b - a);
    if (weights.length < k) return weightFloor;
    return Math.max(weightFloor, weights[k - 1]);
  }

  /** What has been sent in the trailing cap window, oldest first. */
  sentWithin(now: number): readonly Sent[] {
    return this.sent.filter((s) => now - s.at < this.policy.capWindowMs);
  }

  private prune(now: number): void {
    const horizon = Math.max(this.policy.thresholdWindowMs, this.policy.capWindowMs);
    this.offered = this.offered.filter((offer) => now - offer.at < horizon);
    this.sent = this.sent.filter((s) => now - s.at < horizon);
    // Occurrence positions only ever move forward, so a key can't recur
    // once its moment has passed — these are dropped to stop the map
    // growing, not to let anything fire again.
    for (const [key, at] of this.seen) {
      if (now - at >= horizon) this.seen.delete(key);
    }
  }

  toJSON(): NotifyBudgetState {
    return {
      seen: Object.fromEntries(this.seen),
      offered: this.offered,
      sent: this.sent,
    };
  }
}
