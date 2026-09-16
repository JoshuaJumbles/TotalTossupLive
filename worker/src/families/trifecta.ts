import type {
  CoinFace,
  Side,
  TrifectaCell,
  TrifectaNightState,
  TrifectaSheetConfig,
} from '@total-tossup-live/shared';
import { resolveGridCell } from '@total-tossup-live/shared';
import type { FamilyEngine } from './types';

/** Trifecta's round is always exactly 4 flips, same as Teamwork's and for
 * the same reason: the grid math needs exactly 4 bits (2 for row, 2 for
 * column) to address one of the 16 cells. */
const ROUND_SIZE = 4;

/** Every Trifecta Sheet gives both sides exactly nine destroyable targets
 * -- Joshua's own invariant across all of the designs, and what makes the
 * win condition symmetric and tie-proof (damage only ever lands on one
 * side per round, so the two can never run out together). Asserted at
 * config load in presets.ts rather than trusted. */
export const TARGETS_PER_SIDE = 9;

function flipWinnerForFace(face: CoinFace): Side {
  // Not semantically meaningful for Trifecta -- a single flip is one bit
  // of the eventual 4-flip cell address, not its own win/loss. Same
  // placeholder convention teamwork.ts uses.
  return face === 'heads' ? 'humans' : 'demons';
}

function otherSide(side: Side): Side {
  return side === 'humans' ? 'demons' : 'humans';
}

/** Which side a resolved cell scores for. The tile always belongs to the
 * Trifecta side; a symbols cell belongs to whoever owns the icons in it,
 * and a cell never mixes the two sides' icons. */
function attackerFor(config: TrifectaSheetConfig, cell: TrifectaCell<string>): Side {
  if (cell.kind === 'trifecta') return config.trifectaSide;
  return cell.symbols[0] === config.uniformIcon ? otherSide(config.trifectaSide) : config.trifectaSide;
}

/**
 * Which targets a hit takes off the board, as indices into
 * config.targets[side].
 *
 * For now: the lowest tier still standing, in config order -- enough for
 * KingHuman's TriKing to lose limbs before its torso without any extra
 * bookkeeping. Joshua's own within-tier shuffle (so it's not always the
 * same limb first) and the Trifecta side's element preference (an Axe
 * pair losing to the TriKing should take an Axe demon) both land here
 * later; the signature already takes every input either will need, and
 * `destroyed` already records *which* targets went rather than just how
 * many, so neither needs a state-shape change to arrive.
 *
 * A hit bigger than what's left simply overkills: the Night is over
 * either way, and clamping here keeps `destroyed` from ever holding more
 * than the nine that exist.
 */
function chooseTargets(
  config: TrifectaSheetConfig,
  state: TrifectaNightState,
  side: Side,
  damage: number,
): number[] {
  const alreadyGone = new Set(state.destroyed[side]);
  return config.targets[side]
    .map((target, index) => ({ target, index }))
    .filter(({ index }) => !alreadyGone.has(index))
    // Stable sort: same-tier targets keep their config order, so this is
    // "tier order, then config order" rather than anything arbitrary.
    .sort((a, b) => (a.target.tier ?? 0) - (b.target.tier ?? 0))
    .slice(0, damage)
    .map(({ index }) => index);
}

/**
 * The Trifecta Family -- one engine for every Sheet sharing its "uniform
 * force vs. three growing elements" shape (see shared/family.ts's
 * TrifectaSheetConfig for the full writeup; this is that shape in code,
 * with zero Sheet-specific values).
 *
 * Every round resolves one grid cell, which deals damage to the side that
 * *didn't* score it:
 *   - a symbols cell deals one damage per symbol, and on the Trifecta
 *     side also activates every element it names (both at once, for a
 *     two-element cell);
 *   - the Trifecta tile deals one damage per element activated so far,
 *     which is zero until something has lit it up -- the "demons do
 *     nothing" opening beat, falling straight out of the same formula
 *     rather than needing a special case.
 * The Night ends when either side has lost all nine of its targets.
 */
export const trifectaEngine: FamilyEngine<TrifectaNightState, TrifectaSheetConfig> = {
  initNight(_config) {
    return {
      familyId: 'trifecta',
      currentRound: { roundIndex: 0, flips: [] },
      destroyed: { humans: [], demons: [] },
      activated: [],
      lastRound: null,
    };
  },

  applyFlip(state, config, face) {
    const winner = flipWinnerForFace(face);
    const sequenceIndex = state.currentRound.flips.length;
    const flips = [...state.currentRound.flips, { sequenceIndex, face, winner }];

    if (flips.length < ROUND_SIZE) {
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
    const cell = config.arrangement[pairIndex][side];

    const attacker = attackerFor(config, cell);
    const defender = otherSide(attacker);
    const damage = cell.kind === 'trifecta' ? state.activated.length : cell.symbols.length;

    // Only the Trifecta side's own symbols cells light the tile up; the
    // tile itself never activates anything, it only spends what's lit.
    const activated =
      cell.kind === 'symbols' && attacker === config.trifectaSide
        ? [...new Set([...state.activated, ...cell.symbols])]
        : state.activated;

    const hits = chooseTargets(config, state, defender, damage);
    const destroyed = { ...state.destroyed, [defender]: [...state.destroyed[defender], ...hits] };
    const nightWinner = destroyed[defender].length >= TARGETS_PER_SIDE ? attacker : null;

    return {
      state: {
        ...state,
        destroyed,
        activated,
        lastRound: { side: defender, targets: hits },
        // currentRound is kept (not reset) so the round_resolved pause can
        // display the round that just closed; startNextRound() resets it,
        // same convention every other Family uses.
        currentRound: { ...state.currentRound, flips },
      },
      flipWinner: winner,
      roundClosed: true,
      // A zero-damage round -- the tile before anything has lit it up --
      // is a real outcome rather than a non-event: the round closed, and
      // nobody scored. Joshua's own call that this wants a quiet beat
      // rather than any special "nothing happened" treatment.
      roundWinner: damage > 0 ? attacker : null,
      nightWinner,
      // Each destroyed target gets its own full-length reveal at its
      // natural speed, played one after another -- so a round that took
      // three targets needs three times the usual beat. Joshua's own
      // call, and it falls straight out of how CrossOutMark already
      // works: a single mark's animation fills 100% of its window today,
      // leaving no dead air to reclaim, so N marks genuinely want N
      // windows. A round that dealt no damage still gets its one quiet
      // beat rather than being rushed past.
      pauseScale: Math.max(1, hits.length),
    };
  },

  startNextRound(state) {
    return {
      ...state,
      lastRound: null,
      currentRound: { roundIndex: state.currentRound.roundIndex + 1, flips: [] },
    };
  },
};
