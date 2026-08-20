import { describe, expect, it } from 'vitest';
import type { CoinFace, TeamworkNightState, TeamworkSheetConfig } from '@total-tossup-live/shared';
import { teamworkEngine } from './teamwork';
import { CLOUDFIGHT_PRESET } from '../presets';

// humans.action=jetpack+bow (target 5, no defense), demons.action=snake
// (target 6), demons.defense=skull (target 5) -- see presets.ts's
// cloudFightSheet(). This file exists specifically to exercise the one
// thing Barricade's own tests never touch: a single track fed by two
// different icons.
const config = CLOUDFIGHT_PRESET.sheets[0].config as TeamworkSheetConfig;

// Flip sequences worked out against CLOUDFIGHT_ARRANGEMENT: all-tails
// lands on pair 0 (OOO), whose O side is bow; the same pair's X side
// (final flip heads) is snake. Pair 2 (OXO)'s O side is jetpack.
const BOW_FLIPS: CoinFace[] = ['tails', 'tails', 'tails', 'tails'];
const JETPACK_FLIPS: CoinFace[] = ['tails', 'heads', 'tails', 'tails'];
const SNAKE_FLIPS: CoinFace[] = ['tails', 'tails', 'tails', 'heads'];

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

describe('teamworkEngine with CloudFight config (multi-icon humans.action)', () => {
  it("bow and jetpack both add to the same humans.action track", () => {
    let state = teamworkEngine.initNight(config);

    const bowOutcome = playRound(state, BOW_FLIPS);
    expect(bowOutcome.roundWinner).toBe('humans');
    state = teamworkEngine.startNextRound(bowOutcome.state);
    expect(state.humans.action).toEqual(['bow']);

    const jetpackOutcome = playRound(state, JETPACK_FLIPS);
    expect(jetpackOutcome.roundWinner).toBe('humans');
    state = teamworkEngine.startNextRound(jetpackOutcome.state);

    // One combined track, both icons present in order -- this is the
    // "handoff" data the dual-lane renderer reads.
    expect(state.humans.action).toEqual(['bow', 'jetpack']);
  });

  it("declares humans the winner once the combined bow+jetpack count reaches humans.action's target", () => {
    let state = teamworkEngine.initNight(config);
    let nightWinner: string | null = null;
    const alternating = [BOW_FLIPS, JETPACK_FLIPS];

    for (let round = 0; round < config.humans.action.target; round++) {
      const outcome = playRound(state, alternating[round % 2]);
      const isLastRound = round === config.humans.action.target - 1;
      if (isLastRound) {
        expect(outcome.nightWinner).toBe('humans');
        nightWinner = outcome.nightWinner;
      } else {
        expect(outcome.nightWinner).toBeNull();
        state = teamworkEngine.startNextRound(outcome.state);
      }
    }

    expect(nightWinner).toBe('humans');
  });

  it("a snake result favors demons (their own fixed action track)", () => {
    const state = teamworkEngine.initNight(config);
    const outcome = playRound(state, SNAKE_FLIPS);

    expect(outcome.roundWinner).toBe('demons');
    expect(outcome.state.demons.action).toEqual(['snake']);
  });
});
