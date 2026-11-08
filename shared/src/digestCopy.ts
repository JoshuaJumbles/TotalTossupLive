import type { Digest, DigestContext, DigestHeadline } from './digest';
import { digestLeader } from './digest';
import type { SeasonSummary } from './history';
import { seasonScoreOf, seasonWinnerOf, wasSweep, wentTheDistance } from './history';
import type { RecordBreak } from './records';
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

    case 'season_won_from_brink':
      // The result, not the situation — and worded so the two can never be
      // mistaken for each other on the card.
      return `${them(side)} won a Season from the brink`;

    case 'season_swept':
      return `${them(side)} swept a Season`;

    case 'record_broken': {
      // One shape for all three records, which is a choice rather than
      // laziness: the reader is being told a number is the biggest it has
      // ever been, and the sentence that says so should be recognisably
      // the same sentence every time.
      const broken = context.recordBreak;
      if (!broken) return `${them(side)} set an all-time record`;
      return `${them(side)}' ${recordSubject(broken)} is an all-time record`;
    }

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
  const { context, register } = digest;
  const lines: string[] = [];
  const { seasonsSettled, seasonsBy, seasons } = context;

  // Named one by one when history can account for every Season in the
  // absence and there are few enough to read. The equality is the point:
  // a list that quietly dropped the Seasons that had rolled off the ring
  // would read as complete and be wrong, so a partial ring falls back to
  // the count rather than narrating part of the story.
  const narratable = register === 'narrated' && seasonsSettled > 0 && seasons.length === seasonsSettled;

  if (narratable) {
    for (const summary of seasons) lines.push(seasonLine(summary));
  } else if (seasonsSettled === 1) {
    // No history, one Season: it can still be named, just not described.
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

/** What a broken record is a record *of*, as a noun phrase carrying the
 * number — the one part of the record headline that varies. */
function recordSubject(broken: RecordBreak): string {
  switch (broken.id) {
    case 'season_run':
      return `${n(broken.value)}-Season run`;
    case 'lead':
      return `${n(broken.value)}-Season lead`;
    case 'reign':
      return `${n(broken.value)} Seasons in front`;
  }
}

/**
 * One settled Season, as a sentence.
 *
 * This is where a Season going the distance lives, and it belongs here
 * rather than above: a best-of-7 reaches its seventh Week three times in
 * ten, which is five times a day, which is 5.32 bits — under the headline
 * floor and correctly so. A Week 7 decider is the best thing the game
 * produces and it is also a routine Tuesday. As a clause after the score
 * it costs nothing and reads as the detail it is; as a headline it would
 * have been in most digests, which is how a headline stops being read.
 */
function seasonLine(summary: SeasonSummary): string {
  const winner = seasonWinnerOf(summary);
  const took = `${them(winner)} took Season ${n(summary.seasonNumber)}`;
  if (wasSweep(summary)) return `${took} without dropping a Week.`;

  // Winner first, which is the one place in this project that doesn't put
  // the Humans on the left. Everywhere else a score is a standing and the
  // fixed sides are what make it readable at a glance; here the sentence
  // has just named a winner, and "Demons took Season 1,199, 1-4" reads as
  // though they got one. Observed doing exactly that.
  const tally = seasonScoreOf(summary);
  const won = winner ? `${n(tally[winner])}-${n(tally[winner === 'humans' ? 'demons' : 'humans'])}` : score(tally);
  const result = `${took}, ${won}`;
  return wentTheDistance(summary) ? `${result} in a Week ${n(summary.weeks.length)} decider.` : `${result}.`;
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
