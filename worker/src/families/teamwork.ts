import type { TeamworkNightState, TeamworkSheetConfig } from '@total-tossup-live/shared';
import type { FamilyEngine } from './types';

/**
 * First-pass stub for the Teamwork Family (Barricade's own theme: two
 * humans working together — one tending wounds, one hammering the
 * barricade shut — against the demons breaking in). No real rules yet;
 * this exists purely to prove the dispatch pathway and autoplay loop work
 * end to end for a second Family, per Josh's own incremental plan. Every
 * round closes on its very first flip, and humans always win the Night —
 * real Barricade rules (the tracker board's knife/kit/board resources)
 * land once the mechanic itself is designed.
 */
export const teamworkEngine: FamilyEngine<TeamworkNightState, TeamworkSheetConfig> = {
  initNight(_config) {
    return {
      familyId: 'teamwork',
      currentRound: { roundIndex: 0, flips: [] },
    };
  },

  applyFlip(state, _config, face) {
    const winner = 'humans' as const; // stub — always humans, for now
    const flips = [...state.currentRound.flips, { sequenceIndex: state.currentRound.flips.length, face, winner }];

    return {
      state: { ...state, currentRound: { ...state.currentRound, flips } },
      flipWinner: winner,
      roundClosed: true,
      roundWinner: winner,
      nightWinner: winner, // closes the Night on the very first flip
    };
  },

  startNextRound(state) {
    // Never actually reached — nightWinner is always set on the first
    // flip above, so beginNextStep() never routes back here for this
    // Family yet. Kept because FamilyEngine requires it.
    return { ...state, currentRound: { roundIndex: state.currentRound.roundIndex + 1, flips: [] } };
  },
};
