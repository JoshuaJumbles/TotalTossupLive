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

type TrackName = 'attackerAction' | 'defenderAction' | 'defenderDefense';

/** Which of a config's 3 tracks a resolved icon feeds -- every icon
 * belongs to exactly one track, checked by membership rather than a
 * separate lookup table, since the config's own track.icons arrays are
 * already the authoritative source of that mapping. */
function trackFor(config: TeamworkSheetConfig, icon: string): TrackName {
  if (config.attackerAction.icons.includes(icon)) return 'attackerAction';
  if (config.defenderAction.icons.includes(icon)) return 'defenderAction';
  if (config.defenderDefense.icons.includes(icon)) return 'defenderDefense';
  throw new Error(`icon "${icon}" is not assigned to any track in this Sheet's config`);
}

/**
 * The Teamwork Family -- one engine for every Sheet sharing its "attacker
 * vs defender" shape (see shared/family.ts's TeamworkSheetConfig for the
 * full arithmetic writeup; this is purely that arithmetic in code, with
 * zero Sheet-specific values). Every round is 4 flips resolving to one
 * grid cell (see shared/symbolGrid.ts's resolveGridCell), and
 * `config.arrangement` says which icon that cell holds; `trackFor` says
 * which of the 3 tracks that icon feeds.
 *
 * Win check, run after every track update: the defender wins by reaching
 * either defenderAction's target or defenderDefense's target (fully
 * building their own defense also ends the Night immediately, since
 * that's what's been pushing the attacker's own target out). Otherwise
 * the attacker wins by reaching attackerAction.target + <defenderDefense
 * marks so far> -- each defender-defense mark pushes the attacker's own
 * target out by one. Since a round can only ever add to one track, at
 * most one of these can newly become true per round -- no tie-breaking
 * needed between them.
 */
export const teamworkEngine: FamilyEngine<TeamworkNightState, TeamworkSheetConfig> = {
  initNight(_config) {
    return {
      familyId: 'teamwork',
      currentRound: { roundIndex: 0, flips: [] },
      attackerAction: [],
      defenderAction: [],
      defenderDefense: [],
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
    const track = trackFor(config, icon);

    const attackerAction = track === 'attackerAction' ? [...state.attackerAction, icon] : state.attackerAction;
    const defenderAction = track === 'defenderAction' ? [...state.defenderAction, icon] : state.defenderAction;
    const defenderDefense = track === 'defenderDefense' ? [...state.defenderDefense, icon] : state.defenderDefense;

    const defender: Side = config.attacker === 'humans' ? 'demons' : 'humans';
    const roundWinner = track === 'attackerAction' ? config.attacker : defender;

    let nightWinner: Side | null = null;
    if (defenderAction.length >= config.defenderAction.target) {
      nightWinner = defender;
    } else if (defenderDefense.length >= config.defenderDefense.target) {
      nightWinner = defender;
    } else if (attackerAction.length >= config.attackerAction.target + defenderDefense.length) {
      nightWinner = config.attacker;
    }

    return {
      state: {
        ...state,
        attackerAction,
        defenderAction,
        defenderDefense,
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
