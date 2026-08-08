import { describe, expect, it } from 'vitest';
import type { BestOfNightState, BestOfSheetConfig, CoinFace } from '@total-tossup-live/shared';
import { bestOfEngine } from './bestof';
import { PRODUCTION_PRESET } from '../presets';

const config = PRODUCTION_PRESET.sheets[0].config as BestOfSheetConfig; // roundSize: 5, roundWinThreshold: 3, targetRoundPoints: 10

function playFlips(state: BestOfNightState, faces: CoinFace[]) {
  let current = state;
  let last: ReturnType<typeof bestOfEngine.applyFlip> | undefined;
  for (const face of faces) {
    last = bestOfEngine.applyFlip(current, config, face);
    current = last.state;
    if (last.roundClosed) break; // early stop: don't keep flipping a closed round
  }
  return last!;
}

describe('bestOfEngine', () => {
  it('closes a round early once the win threshold is hit, without exhausting roundSize', () => {
    const state = bestOfEngine.initNight(config);
    const outcome = playFlips(state, ['heads', 'heads', 'heads', 'tails', 'tails']);

    expect(outcome.roundClosed).toBe(true);
    expect(outcome.roundWinner).toBe('humans');
    expect(outcome.nightWinner).toBeNull();
    expect(outcome.state.currentRound.flips).toHaveLength(3); // stopped at 3, never saw the trailing 'tails'
    expect(outcome.state.roundPoints).toEqual({ humans: 1, demons: 0 });
    expect(outcome.state.completedRounds).toBe(1);
  });

  it('lets the trailing side win a round that goes the full roundSize', () => {
    const state = bestOfEngine.initNight(config);
    const outcome = playFlips(state, ['heads', 'tails', 'heads', 'tails', 'tails']);

    expect(outcome.roundClosed).toBe(true);
    expect(outcome.roundWinner).toBe('demons');
    expect(outcome.state.currentRound.flips).toHaveLength(5);
  });

  it('keeps the closed round visible until startNextRound() resets it', () => {
    const state = bestOfEngine.initNight(config);
    const outcome = playFlips(state, ['heads', 'heads', 'heads']);
    expect(outcome.state.currentRound.flips).toHaveLength(3);

    const reset = bestOfEngine.startNextRound(outcome.state);
    expect(reset.currentRound.flips).toHaveLength(0);
    expect(reset.currentRound.roundIndex).toBe(outcome.state.currentRound.roundIndex + 1);
    expect(reset.currentRound.flipWins).toEqual({ humans: 0, demons: 0 });
    // completedRounds and roundPoints survive the reset
    expect(reset.completedRounds).toBe(1);
    expect(reset.roundPoints).toEqual({ humans: 1, demons: 0 });
  });

  it('declares a Night winner only once roundPoints hits targetRoundPoints', () => {
    let state = bestOfEngine.initNight(config);
    let nightWinner: string | null = null;

    for (let round = 0; round < config.targetRoundPoints; round++) {
      const outcome = playFlips(state, ['heads', 'heads', 'heads']); // humans sweep every round
      expect(outcome.roundClosed).toBe(true);
      expect(outcome.roundWinner).toBe('humans');

      const isLastRound = round === config.targetRoundPoints - 1;
      if (isLastRound) {
        expect(outcome.nightWinner).toBe('humans');
        nightWinner = outcome.nightWinner;
      } else {
        expect(outcome.nightWinner).toBeNull();
        state = bestOfEngine.startNextRound(outcome.state);
      }
    }

    expect(nightWinner).toBe('humans');
  });

  it('maps heads to humans and tails to demons', () => {
    const state = bestOfEngine.initNight(config);
    const headsOutcome = bestOfEngine.applyFlip(state, config, 'heads');
    expect(headsOutcome.flipWinner).toBe('humans');

    const tailsOutcome = bestOfEngine.applyFlip(state, config, 'tails');
    expect(tailsOutcome.flipWinner).toBe('demons');
  });
});
