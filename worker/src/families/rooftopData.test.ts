import { describe, expect, it } from 'vitest';
import type { CoinFace, TeamworkNightState, TeamworkSheetConfig } from '@total-tossup-live/shared';
import { teamworkEngine } from './teamwork';
import { ROOFTOP_PRESET } from '../presets';

// humans.action=spear+guns (target 5), humans.defense=music (target 4,
// pushValue 0.5), demons.action=blast (target 5), demons.defense=crystal
// (target 4, pushValue 0.5) -- see presets.ts's rooftopSheet(). This file
// exists specifically to exercise the one thing no other Sheet's tests
// touch: a fractional pushValue, both for how it slows pushback (two
// marks per point instead of one) and for how a defense track's own win
// condition needs one mark *past* its "value" cap rather than reaching
// it exactly (Josh's own "wins when it exceeds the target" framing).
const config = ROOFTOP_PRESET.sheets[0].config as TeamworkSheetConfig;

// Flip sequences worked out against ROOFTOP_ARRANGEMENT: all-tails lands
// on pair 0 (OOO), whose O side is blast; the same pair's X side (final
// flip heads) is spear. Pair 1 (OOX)'s O side is guns. Pair 2 (OXO)'s X
// side is music. Pair 4 (XOO)'s X side is crystal.
const BLAST_FLIPS: CoinFace[] = ['tails', 'tails', 'tails', 'tails'];
const SPEAR_FLIPS: CoinFace[] = ['tails', 'tails', 'tails', 'heads'];
const GUNS_FLIPS: CoinFace[] = ['tails', 'tails', 'heads', 'tails'];
const MUSIC_FLIPS: CoinFace[] = ['tails', 'heads', 'tails', 'heads'];
const CRYSTAL_FLIPS: CoinFace[] = ['heads', 'tails', 'tails', 'heads'];

function playRound(state: TeamworkNightState, faces: CoinFace[]) {
  let current = state;
  let last: ReturnType<typeof teamworkEngine.applyFlip> | undefined;
  for (const face of faces) {
    last = teamworkEngine.applyFlip(current, config, face);
    current = last.state;
    if (last.roundClosed) break;
  }
  return last!;
}

/** Plays `count` rounds of the given flip sequence, asserting no winner
 * until the very last one, and returns that final outcome. */
function playRounds(state: TeamworkNightState, faces: CoinFace[], count: number) {
  let current = state;
  let outcome: ReturnType<typeof teamworkEngine.applyFlip> | undefined;
  for (let i = 0; i < count; i++) {
    outcome = playRound(current, faces);
    if (i < count - 1) {
      expect(outcome.nightWinner).toBeNull();
      current = teamworkEngine.startNextRound(outcome.state);
    }
  }
  return outcome!;
}

describe('teamworkEngine with Rooftop config (fractional pushValue)', () => {
  it('spear and guns both add to the same humans.action track', () => {
    let state = teamworkEngine.initNight(config);

    const spearOutcome = playRound(state, SPEAR_FLIPS);
    expect(spearOutcome.roundWinner).toBe('humans');
    state = teamworkEngine.startNextRound(spearOutcome.state);
    expect(state.humans.action).toEqual(['spear']);

    const gunsOutcome = playRound(state, GUNS_FLIPS);
    state = teamworkEngine.startNextRound(gunsOutcome.state);
    expect(state.humans.action).toEqual(['spear', 'guns']);
  });

  it('a music result adds to humans.defense and a crystal result to demons.defense', () => {
    const musicOutcome = playRound(teamworkEngine.initNight(config), MUSIC_FLIPS);
    expect(musicOutcome.roundWinner).toBe('humans');
    expect(musicOutcome.state.humans.defense).toEqual(['music']);

    const crystalOutcome = playRound(teamworkEngine.initNight(config), CRYSTAL_FLIPS);
    expect(crystalOutcome.roundWinner).toBe('demons');
    expect(crystalOutcome.state.demons.defense).toEqual(['crystal']);
  });

  it('two music marks are worth one point of pushback, not two -- blast needs target+1 (not +2) after 2 marks', () => {
    let state = teamworkEngine.initNight(config);

    // Two music marks: floor(2 * 0.5) = 1 point of pushback.
    for (let i = 0; i < 2; i++) {
      const outcome = playRound(state, MUSIC_FLIPS);
      state = teamworkEngine.startNextRound(outcome.state);
    }
    expect(state.humans.defense).toHaveLength(2);

    // blast's effective target is now 5 + 1 = 6 -- 5 blast marks must NOT
    // win yet (would have won outright with no pushback at all).
    const fiveBlasts = playRounds(state, BLAST_FLIPS, 5);
    expect(fiveBlasts.nightWinner).toBeNull();
    expect(fiveBlasts.state.demons.action).toHaveLength(5);

    // The 6th reaches the pushed-back target.
    const sixthBlast = playRound(teamworkEngine.startNextRound(fiveBlasts.state), BLAST_FLIPS);
    expect(sixthBlast.nightWinner).toBe('demons');
  });

  it('an odd (3rd) music mark does not add another point of pushback -- floor(3 * 0.5) is still 1', () => {
    let state = teamworkEngine.initNight(config);
    for (let i = 0; i < 3; i++) {
      const outcome = playRound(state, MUSIC_FLIPS);
      state = teamworkEngine.startNextRound(outcome.state);
    }
    expect(state.humans.defense).toHaveLength(3);

    // Still only +1 pushback (not +1.5) -- 6 blasts should win, matching
    // the 2-mark case above exactly.
    const outcome = playRounds(state, BLAST_FLIPS, 6);
    expect(outcome.nightWinner).toBe('demons');
  });

  it("humans.defense (music) does NOT win at 8 marks -- a fully-built-but-not-exceeded value doesn't count", () => {
    let state = teamworkEngine.initNight(config);
    const outcome = playRounds(state, MUSIC_FLIPS, 8);

    // 8 marks * 0.5 = exactly 4 (music's own target) -- Josh's own "wins
    // when it EXCEEDS the target" rule means this must NOT be a win yet.
    expect(outcome.nightWinner).toBeNull();
    expect(outcome.state.humans.defense).toHaveLength(8);
  });

  it('humans.defense (music) wins at the 9th mark -- one past the value cap', () => {
    const outcome = playRounds(teamworkEngine.initNight(config), MUSIC_FLIPS, 9);

    expect(outcome.nightWinner).toBe('humans');
    expect(outcome.state.humans.defense).toHaveLength(9);
  });

  it("demons.defense (crystal) follows the identical rule (doesn't win at 8, wins at 9)", () => {
    const eightMarks = playRounds(teamworkEngine.initNight(config), CRYSTAL_FLIPS, 8);
    expect(eightMarks.nightWinner).toBeNull();

    const ninthMark = playRound(teamworkEngine.startNextRound(eightMarks.state), CRYSTAL_FLIPS);
    expect(ninthMark.nightWinner).toBe('demons');
  });

  it('a fully-built defense (8 marks) pushes the opposing action target out to its maximum of 9', () => {
    let state = teamworkEngine.initNight(config);
    for (let i = 0; i < 8; i++) {
      const outcome = playRound(state, MUSIC_FLIPS);
      state = teamworkEngine.startNextRound(outcome.state);
    }
    expect(state.humans.defense).toHaveLength(8); // floor(8 * 0.5) = 4 points of pushback

    // blast's target is now 5 + 4 = 9 -- 8 blasts must not be enough.
    const eightBlasts = playRounds(state, BLAST_FLIPS, 8);
    expect(eightBlasts.nightWinner).toBeNull();

    const ninthBlast = playRound(teamworkEngine.startNextRound(eightBlasts.state), BLAST_FLIPS);
    expect(ninthBlast.nightWinner).toBe('demons');
  });
});
