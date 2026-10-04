import type {
  CoinFace,
  RpfBout,
  RpfNightState,
  RpfSheetConfig,
  RpfType,
  Side,
} from '@total-tossup-live/shared';
import type { FamilyEngine, FlipOutcome, Shuffle } from './types';

/** Flips 1-2 pick the left fighter, 3-4 the right. A fifth is added only
 * when the matchup ties. */
const PICK_FLIPS = 4;

/** Which Rock/Paper/Scissors type beats which. */
const BEATS: Record<Exclude<RpfType, 'royalty'>, RpfType> = {
  rock: 'scissors',
  scissors: 'paper',
  paper: 'rock',
};

const OTHER: Record<Side, Side> = { humans: 'demons', demons: 'humans' };

function flipWinnerForFace(face: CoinFace): Side {
  // Not semantically meaningful here -- a single flip is one bit of a
  // fighter's address, or the tiebreaker, never its own win or loss. Same
  // placeholder convention teamwork.ts and trifecta.ts use.
  return face === 'heads' ? 'humans' : 'demons';
}

/** Two flips as a 0-3 lineup index, most significant first: OO is 0 (the
 * bottom of the arc), OX 1, XO 2, XX 3 -- Joshua's own numbering, and the
 * same order the Processing renderer lays the fighters out in. */
function pickIndex(first: CoinFace, second: CoinFace): number {
  return (first === 'heads' ? 2 : 0) + (second === 'heads' ? 1 : 0);
}

function healthOf(config: RpfSheetConfig, side: Side, index: number): number {
  return config.lineup[side][index].type === 'royalty' ? config.royaltyHealth : config.rpsHealth;
}

function isDown(state: RpfNightState, config: RpfSheetConfig, side: Side, index: number): boolean {
  return state.damage[side][index] >= healthOf(config, side, index);
}

function royaltyIndex(config: RpfSheetConfig, side: Side): number {
  const index = config.lineup[side].findIndex((fighter) => fighter.type === 'royalty');
  if (index < 0) throw new Error(`Rock Paper Flipper: ${side} has no royalty in its lineup`);
  return index;
}

type Verdict = { kind: 'winner'; winner: Side } | { kind: 'tie' };

/**
 * The whole resolution table, in one place.
 *
 * A KO'd fighter is a hole in its side's line: the blow goes through it
 * to that side's Royalty, which is the only way a Royalty can be reached
 * in the default `scrappy` setting without winning a tiebreaker. A KO'd
 * fighter is also the lowest power there is, losing to everything -- so
 * the only way it doesn't lose is when BOTH sides pick a downed fighter,
 * which ties.
 */
function verdict(state: RpfNightState, config: RpfSheetConfig, picked: Record<Side, number>): Verdict {
  const leftSide = config.leftSide;
  const rightSide = OTHER[leftSide];

  const leftDown = isDown(state, config, leftSide, picked[leftSide]);
  const rightDown = isDown(state, config, rightSide, picked[rightSide]);
  if (leftDown && rightDown) return { kind: 'tie' };
  if (leftDown) return { kind: 'winner', winner: rightSide };
  if (rightDown) return { kind: 'winner', winner: leftSide };

  const leftType = config.lineup[leftSide][picked[leftSide]].type;
  const rightType = config.lineup[rightSide][picked[rightSide]].type;

  const leftRoyal = leftType === 'royalty';
  const rightRoyal = rightType === 'royalty';

  // Royalty against Royalty is a tie whatever the strength setting.
  if (leftRoyal && rightRoyal) return { kind: 'tie' };

  if (leftRoyal || rightRoyal) {
    const royalSide = leftRoyal ? leftSide : rightSide;
    switch (config.royaltyStrength) {
      case 'powerful':
        return { kind: 'winner', winner: royalSide };
      case 'vulnerable':
        return { kind: 'winner', winner: OTHER[royalSide] };
      case 'scrappy':
        return { kind: 'tie' };
    }
  }

  if (leftType === rightType) return { kind: 'tie' };
  return BEATS[leftType as Exclude<RpfType, 'royalty'>] === rightType
    ? { kind: 'winner', winner: leftSide }
    : { kind: 'winner', winner: rightSide };
}

/**
 * Where the damage actually lands. Normally the loser's picked fighter,
 * but when that fighter is already down the blow carries through to their
 * Royalty -- Joshua's "hitting the Royalty in a weak spot", and the
 * reason the arrow for such a round runs from the attacker straight to
 * the Royalty rather than to the fighter the flips named.
 */
function landing(
  state: RpfNightState,
  config: RpfSheetConfig,
  loser: Side,
  pickedIndex: number,
): { defenderIndex: number; weakSpot: boolean } {
  if (!isDown(state, config, loser, pickedIndex)) {
    return { defenderIndex: pickedIndex, weakSpot: false };
  }
  return { defenderIndex: royaltyIndex(config, loser), weakSpot: true };
}

export const rockPaperFlipperEngine: FamilyEngine<RpfNightState, RpfSheetConfig> = {
  // No per-Night randomness to draw: which fighter is picked comes from
  // the coins, and the lineup order is fixed config, so the shuffle the
  // coordinator offers goes unused here.
  initNight(config: RpfSheetConfig, _shuffle: Shuffle): RpfNightState {
    return {
      familyId: 'rpf',
      currentRound: { roundIndex: 0, flips: [] },
      damage: {
        humans: config.lineup.humans.map(() => 0),
        demons: config.lineup.demons.map(() => 0),
      },
      history: [],
      lastRound: null,
    };
  },

  applyFlip(state, config, face) {
    const sequenceIndex = state.currentRound.flips.length;
    const flipWinner = flipWinnerForFace(face);
    const flips = [...state.currentRound.flips, { sequenceIndex, face, winner: flipWinner }];
    const open: FlipOutcome<RpfNightState> = {
      state: { ...state, currentRound: { ...state.currentRound, flips } },
      flipWinner,
      roundClosed: false,
      roundWinner: null,
      nightWinner: null,
    };

    if (flips.length < PICK_FLIPS) return open;

    const leftSide = config.leftSide;
    const rightSide = OTHER[leftSide];
    // Every flip in this round has landed by now, so the faces are real;
    // Flip.face is nullable only for slots still awaiting a result.
    const faceAt = (i: number): CoinFace => flips[i].face as CoinFace;
    const picked: Record<Side, number> = {
      [leftSide]: pickIndex(faceAt(0), faceAt(1)),
      [rightSide]: pickIndex(faceAt(2), faceAt(3)),
    } as Record<Side, number>;

    const called = verdict(state, config, picked);

    // A tie holds the round open for a fifth, tie-breaking flip rather
    // than resolving to nothing -- every round lands exactly one damage.
    if (called.kind === 'tie' && flips.length === PICK_FLIPS) return open;

    const winner =
      called.kind === 'winner'
        ? called.winner
        : // Tiebreaker: tails gives it to the left of the ring, heads to
          // the right, matching O/X reading as 0/1 everywhere else.
          faceAt(PICK_FLIPS) === 'heads'
          ? rightSide
          : leftSide;

    const loser = OTHER[winner];
    const { defenderIndex, weakSpot } = landing(state, config, loser, picked[loser]);

    const damage = {
      humans: [...state.damage.humans],
      demons: [...state.damage.demons],
    };
    damage[loser][defenderIndex] += 1;

    const bout: RpfBout = {
      picked,
      attacker: winner,
      defenderIndex,
      weakSpot,
      tiebreak: flips.length > PICK_FLIPS,
    };

    const royalDown = (side: Side) =>
      damage[side][royaltyIndex(config, side)] >= config.royaltyHealth;
    const nightWinner = royalDown(loser) ? winner : null;

    return {
      state: {
        ...state,
        currentRound: { ...state.currentRound, flips },
        damage,
        history: [...state.history, bout],
        lastRound: bout,
      },
      flipWinner: winner,
      roundClosed: true,
      roundWinner: winner,
      nightWinner,
    };
  },

  startNextRound(state) {
    return {
      ...state,
      currentRound: { roundIndex: state.currentRound.roundIndex + 1, flips: [] },
      lastRound: null,
    };
  },
};
