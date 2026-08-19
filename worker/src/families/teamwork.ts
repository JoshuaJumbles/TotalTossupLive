import type { CoinFace, Side, TeamworkNightState, TeamworkSheetConfig } from '@total-tossup-live/shared';
import { resolveGridCell } from '@total-tossup-live/shared';
import type { FamilyEngine } from './types';

/** Teamwork's round is always exactly 4 flips -- not a tunable config knob
 * like bestof's roundSize, since the grid math itself needs exactly 4 bits
 * (2 for row, 2 for column) to address one of the 16 cells. */
const ROUND_SIZE = 4;

function flipWinnerForFace(face: CoinFace): Side {
  // Not semantically meaningful for Teamwork -- a single flip is just one
  // bit of the eventual 4-flip cell address, not its own win/loss. Kept
  // only because FlipOutcome requires a Side per flip; same placeholder
  // convention bestof.ts uses for its own (real) per-flip winner.
  return face === 'heads' ? 'humans' : 'demons';
}

/**
 * The Teamwork Family (Barricade's own theme: two humans working together
 * -- one tending wounds, one hammering the barricade shut -- against the
 * demons breaking in). Every round is 4 flips resolving to one grid cell
 * (see shared/symbolGrid.ts's resolveGridCell), and `config.arrangement`
 * says which icon that cell holds.
 *
 * Win math, worked out from Josh's own examples: humans win by reaching
 * `targetMedkit` medkit hits OR `targetBarricade` barricade hits. Demons
 * win by reaching `baseTargetKnife + barricadeCount` knife hits -- each
 * barricade hit "defends" by pushing the demons' own target out by one
 * (Barricade's numbers: base 5, so 0 barricades marked = need 5 knives,
 * 1 marked = need 6, 2 marked = need 7, and so on, matching "the demons
 * will win when they cross into the first empty defensive position").
 * Since a round can only ever increment one of the three counts, at most
 * one win condition can newly become true per round -- no tie-breaking
 * needed between them.
 */
export const teamworkEngine: FamilyEngine<TeamworkNightState, TeamworkSheetConfig> = {
  initNight(_config) {
    return {
      familyId: 'teamwork',
      currentRound: { roundIndex: 0, flips: [] },
      medkitCount: 0,
      knifeCount: 0,
      barricadeCount: 0,
    };
  },

  applyFlip(state, config, face) {
    const winner = flipWinnerForFace(face);
    const sequenceIndex = state.currentRound.flips.length;
    const flips = [...state.currentRound.flips, { sequenceIndex, face, winner }];

    const roundClosed = flips.length >= ROUND_SIZE;

    if (!roundClosed) {
      return {
        state: { ...state, currentRound: { ...state.currentRound, flips } },
        flipWinner: winner,
        roundClosed: false,
        roundWinner: null,
        nightWinner: null,
      };
    }

    // All 4 faces are resolved by construction (a flip only reaches here
    // once its face is revealed), so this cast is safe.
    const faces = flips.map((f) => f.face) as [CoinFace, CoinFace, CoinFace, CoinFace];
    const { pairIndex, side } = resolveGridCell(faces);
    const icon = config.arrangement[pairIndex][side];

    let medkitCount = state.medkitCount;
    let knifeCount = state.knifeCount;
    let barricadeCount = state.barricadeCount;
    let roundWinner: Side;

    if (icon === 'medkit') {
      medkitCount += 1;
      roundWinner = 'humans';
    } else if (icon === 'planks') {
      barricadeCount += 1;
      roundWinner = 'humans';
    } else {
      knifeCount += 1;
      roundWinner = 'demons';
    }

    let nightWinner: Side | null = null;
    if (medkitCount >= config.targetMedkit) {
      nightWinner = 'humans';
    } else if (barricadeCount >= config.targetBarricade) {
      nightWinner = 'humans';
    } else if (knifeCount >= config.baseTargetKnife + barricadeCount) {
      nightWinner = 'demons';
    }

    return {
      state: {
        ...state,
        medkitCount,
        knifeCount,
        barricadeCount,
        // currentRound is kept (not reset) so the round_resolved pause
        // can display the round that just closed; startNextRound() resets
        // it, same convention bestof.ts uses.
        currentRound: { ...state.currentRound, flips },
      },
      flipWinner: winner,
      roundClosed: true,
      roundWinner,
      nightWinner,
    };
  },

  startNextRound(state) {
    return { ...state, currentRound: { roundIndex: state.currentRound.roundIndex + 1, flips: [] } };
  },
};
