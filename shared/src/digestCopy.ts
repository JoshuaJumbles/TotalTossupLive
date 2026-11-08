import type { Digest, DigestContext, DigestHeadline } from './digest';
import { digestLeader } from './digest';
import type { ContainerScore, Side } from './scoring';

/**
 * How a digest reads.
 *
 * The retrospective register of dramaCopy.ts, kept apart from digest.ts
 * for the same reason that one is kept apart from drama.ts: the wording
 * should be rewritable without going near the detection.
 *
 * The whole voice here is past tense and settled, which is the real
 * difference from a notification. A push says "the Humans can take the
 * Season this Week" — it's an invitation. A digest says "the Humans took
 * it" — it's a result. Same predicate underneath, opposite relationship to
 * the reader, and copy written in the wrong one of those reads as either a
 * spoiler or a tease.
 *
 * Headlines are short on purpose: one clause, no semicolons, no numbers
 * the line doesn't need. The numbers live in the context lines below them,
 * which is what makes a headline able to be punchy at all.
 *
 * They also carry no full stop, which looks like fussiness and isn't once
 * you see them set: the display face is all caps, and a terminal period
 * under a stack of capitals reads as a typo rather than as punctuation.
 * Context lines are ordinary sentences and keep theirs.
 */

const NAME: Record<Side, string> = { humans: 'Humans', demons: 'Demons' };

function them(side: Side | null): string {
  return side ? NAME[side] : 'Someone';
}

const n = (value: number) => value.toLocaleString();
const score = (s: ContainerScore) => `${n(s.humans)}-${n(s.demons)}`;

/** "2h 40m", "18m", "3 days". Rounded hard — nobody wants a digest that
 * reports seconds. */
export function awayLabel(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${Math.max(1, minutes)}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const rest = minutes % 60;
    return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
  }
  const days = Math.round(hours / 24);
  return days === 1 ? 'a day' : `${days} days`;
}

export function headlineCopy(headline: DigestHeadline, context: DigestContext): string {
  const { side } = headline;

  switch (headline.id) {
    case 'record_changed_hands':
      return `${them(side)} took the all-time lead`;

    case 'record_drawn_level':
      return `The all-time record is level`;

    case 'streak_broken':
      // The length is the story, and it's the length the run *reached* —
      // only the pre-absence streak still remembers it, because the live
      // one has already reset to whoever ended it.
      return `${them(side)}' ${context.streakWas.length}-Season run is over`;

    case 'streak_started':
      return `${them(side)} are on a run of ${context.streak.length}`;

    case 'streak_extended':
      return `${them(side)} made it ${context.streak.length} Seasons straight`;

    case 'season_comeback':
      return `${them(side)} came back from the brink`;

    case 'season_run': {
      // season_run always names a side — it's the one that took most of
      // them — so this is only ever the fallback the type demands.
      const took = side ? context.seasonsBy[side] : context.seasonsSettled;
      return `${them(side)} took ${n(took)} of ${n(context.seasonsSettled)} Seasons`;
    }

    case 'milestone_passed':
      return `Season ${n(context.seasonNumber)} went by`;
  }
}

/**
 * The lines under the headlines: what settled, and where things stand.
 *
 * None of this is ranked or gated, which is the structural point of the
 * feature — "the Demons took Week 4" happens ninety-three times a day and
 * would never clear a headline bar, but it's exactly what you want to read
 * once something else has earned your attention. Separating the two is
 * what lets the headlines stay punchy without the digest becoming thin.
 */
export function contextLines(digest: Digest): string[] {
  // The register doesn't change the wording — it decides whether a digest
  // exists at all when nothing cleared the headline bar (see digest.ts).
  const { context } = digest;
  const lines: string[] = [];
  const { seasonsSettled, seasonsBy } = context;

  if (seasonsSettled === 1) {
    // One Season can be named. More than one can only be counted, because
    // the diff knows how many each side took and not which was which.
    const winner = seasonsBy.humans > 0 ? 'humans' : 'demons';
    lines.push(`${them(winner)} took Season ${n(context.lastSettledSeason)}.`);
  } else if (seasonsSettled > 1) {
    lines.push(`${n(seasonsSettled)} Seasons settled — ${score(seasonsBy)}.`);
  }

  // Where the live Season is now. Always worth stating: it's the thing the
  // reader is about to start watching.
  const leader = digestLeader(context.seasonScore);
  const seasonStanding = leader
    ? `${them(leader)} lead it ${score(context.seasonScore)}`
    : `level at ${score(context.seasonScore)}`;
  lines.push(`Season ${n(context.seasonNumber)} is on Week ${n(context.weekNumber)}, ${seasonStanding}.`);

  // The record, but only when it moved — otherwise it's furniture.
  if (
    context.record.humans !== context.recordWas.humans ||
    context.record.demons !== context.recordWas.demons
  ) {
    lines.push(`All-time: ${score(context.record)}.`);
  }

  return lines;
}

/** The whole digest as flat text — what a card renders and what a test can
 * read at a glance. */
export function digestLines(digest: Digest): { title: string; headlines: string[]; context: string[] } {
  return {
    title: `While you were away — ${awayLabel(digest.context.awayMs)}`,
    headlines: digest.headlines.map((headline) => headlineCopy(headline, digest.context)),
    context: contextLines(digest),
  };
}
