import type { BestOfNightState, BestOfSheetConfig, CoinFace, Side } from '@total-tossup-live/shared';
import { emptyScore } from '@total-tossup-live/shared';
import type { FamilyEngine } from './types';

function flipWinnerForFace(face: CoinFace): Side {
  return face === 'heads' ? 'humans' : 'demons';
}

/**
 * The debug/practice Family: best-of-`roundSize` coin flips per round with
 * early stop at `roundWinThreshold` flip-wins; winning a round earns one
 * round-point; race to `targetRoundPoints` round-points wins the Night.
 */
export const bestOfEngine: FamilyEngine<BestOfNightState, BestOfSheetConfig> = {
  initNight(_config) {
    return {
      familyId: 'bestof',
      roundPoints: emptyScore(),
      currentRound: { roundIndex: 0, flips: [], flipWins: emptyScore() },
      completedRounds: 0,
    };
  },

  applyFlip(state, config, face) {
    const winner = flipWinnerForFace(face);
    const sequenceIndex = state.currentRound.flips.length;
    const flips = [...state.currentRound.flips, { sequenceIndex, face, winner }];
    const flipWins = {
      ...state.currentRound.flipWins,
      [winner]: state.currentRound.flipWins[winner] + 1,
    };

    // Only the side that just flipped can have crossed the threshold, so
    // whoever this flip favored is the only possible round winner here.
    const roundClosed = flipWins[winner] >= config.roundWinThreshold;

    if (!roundClosed) {
      return {
        state: { ...state, currentRound: { ...state.currentRound, flips, flipWins } },
        flipWinner: winner,
        roundClosed: false,
        roundWinner: null,
        nightWinner: null,
      };
    }

    const roundWinner = winner;
    const roundPoints = {
      ...state.roundPoints,
      [roundWinner]: state.roundPoints[roundWinner] + 1,
    };
    const nightWinner = roundPoints[roundWinner] >= config.targetRoundPoints ? roundWinner : null;

    return {
      state: {
        ...state,
        roundPoints,
        completedRounds: state.completedRounds + 1,
        // currentRound is kept (not reset) so the round_resolved pause can
        // display the round that just closed; startNextRound() resets it.
        currentRound: { ...state.currentRound, flips, flipWins },
      },
      flipWinner: winner,
      roundClosed: true,
      roundWinner,
      nightWinner,
    };
  },

  startNextRound(state) {
    return {
      ...state,
      currentRound: { roundIndex: state.currentRound.roundIndex + 1, flips: [], flipWins: emptyScore() },
    };
  },
};
