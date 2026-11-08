import type { DramaInput, DramaMoment, DramaReport } from './drama';
import { brinkOf } from './drama';
import type { Side } from './scoring';

/**
 * How a moment reads out loud.
 *
 * Kept apart from drama.ts so the wording can be rewritten without going
 * anywhere near the detection, and kept in shared/ rather than in the
 * sender so a push, a web banner and the widget's label are the same
 * sentence rather than three drifting paraphrases of one.
 *
 * `label` is the two-or-three-word badge a screen can show; `title` and
 * `body` are the two lines a notification gets. Nothing here knows about
 * a favourite team yet, but every moment carries the side it's about (see
 * DramaMoment.side), which is the hook for slanting these later —
 * "they're coming back" versus "we're about to blow it" is the same
 * predicate read from two directions.
 */

const NAME: Record<Side, string> = { humans: 'Humans', demons: 'Demons' };

function them(side: Side | null): string {
  return side ? NAME[side] : 'Someone';
}

export interface MomentCopy {
  label: string;
  title: string;
  body: string;
}

export function momentCopy(moment: DramaMoment, input: DramaInput): MomentCopy {
  const { side } = moment;
  const week = `Week ${input.weekNumber}`;
  const season = `Season ${input.seasonNumber.toLocaleString()}`;
  const streak = input.seasonStreak;
  const weekBrink = brinkOf(input.nightsPerWeek);
  const seasonBrink = brinkOf(input.weeksPerSeason);
  /** Whatever the side in front holds all-time — the figure a drawn-level
   * record would land on. */
  const record = Math.max(input.lifetimeRecord.humans, input.lifetimeRecord.demons);

  switch (moment.id) {
    case 'title_night':
      return {
        label: 'Title Night',
        title: 'Winner takes the Season',
        body: `${season} is level and so is the Week. The Night on now decides the whole thing.`,
      };

    case 'record_level':
      // Only fires on a one-Season gap, so the level figure is whatever
      // the side in front already has.
      return {
        label: 'Record on the line',
        title: 'The all-time record can be drawn level',
        body: `${them(side)} take this Season and it's ${record}-${record} — dead level, after ${input.seasonNumber.toLocaleString()} Seasons of it.`,
      };

    case 'record_lead':
      // And this one only fires from dead level, so there is no "behind"
      // to appeal to: the tie itself is the story.
      return {
        label: 'Record on the line',
        title: `${them(side)} can take the all-time lead`,
        body: `Level at ${input.lifetimeRecord.humans}-${input.lifetimeRecord.demons} after ${input.seasonNumber.toLocaleString()} Seasons. This one breaks the tie.`,
      };

    case 'season_comeback':
      return {
        label: 'Comeback',
        title: `${them(side)} were ${seasonBrink} Weeks down with none`,
        body: `Level now, and the Season comes down to this Week.`,
      };

    case 'week_comeback':
      return {
        label: 'Comeback',
        title: `${them(side)} were ${weekBrink} Nights down with none`,
        body: `Level now, and the Night on decides the Week.`,
      };

    case 'streak_on_line':
      return {
        label: 'Streak',
        title: `${them(streak.side)}' ${streak.length}-Season run is on the line`,
        body: `This Week either extends it or ends it.`,
      };

    case 'season_decider':
      return {
        label: 'Decider',
        title: `${season} is going the distance`,
        body: `Level on Weeks. Whoever takes this one takes the Season.`,
      };

    case 'season_sweep_watch':
      return {
        label: 'Sweep',
        title: `${them(side)} are one Week from a clean Season`,
        body: `Not a single Week conceded so far.`,
      };

    case 'season_point':
      return {
        label: 'Season point',
        title: `${them(side)} can take ${season} this Week`,
        body: `${season} sits ${input.seasonScore.humans}-${input.seasonScore.demons} on Weeks.`,
      };

    case 'week_decider':
      return {
        label: 'Decider',
        title: `${week} is going the distance`,
        body: `Level on Nights. The Night on now takes the Week.`,
      };

    case 'week_sweep_watch':
      return {
        label: 'Sweep',
        title: `${them(side)} are one Night from a clean Week`,
        body: `Not a Night conceded yet.`,
      };

    case 'week_point':
      return {
        label: 'Match point',
        title: `${them(side)} can close ${week} out tonight`,
        body: `${input.weekScore.humans}-${input.weekScore.demons} on Nights.`,
      };

    case 'milestone_season':
      return {
        label: season,
        title: `${season} starts now`,
        body: `A round number. Someone should be watching.`,
      };
  }
}

/** The copy for the rarest live moment — what a sender would send and a
 * screen would badge. Null when nothing is live. */
export function reportCopy(report: DramaReport, input: DramaInput): MomentCopy | null {
  const top = report.moments[0];
  return top ? momentCopy(top, input) : null;
}
