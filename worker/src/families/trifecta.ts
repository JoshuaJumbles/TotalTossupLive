import type {
  CoinFace,
  Side,
  TrifectaCell,
  TrifectaNightState,
  TrifectaSheetConfig,
  TrifectaTarget,
} from '@total-tossup-live/shared';
import { resolveGridCell } from '@total-tossup-live/shared';
import type { FamilyEngine, Shuffle } from './types';

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

/** The order a side's nine targets fall in over a Night: grouped by tier
 * (lowest first, so KingHuman's TriKing loses limbs before the torso
 * space holding its operators), shuffled within each tier so it isn't the
 * same limb first every time. A side whose targets carry no tiers at all
 * -- the Trifecta side, whose nine are element groups rather than
 * priorities -- is simply one group, so its order comes out fully
 * shuffled, which is exactly what's wanted before an element preference
 * is applied on top. */
function crossOrderFor<TIcon extends string>(
  targets: TrifectaTarget<TIcon>[],
  shuffle: Shuffle,
): number[] {
  const byTier = new Map<number, number[]>();
  targets.forEach((target, index) => {
    const tier = target.tier ?? 0;
    if (!byTier.has(tier)) byTier.set(tier, []);
    byTier.get(tier)!.push(index);
  });

  return [...byTier.keys()]
    .sort((a, b) => a - b)
    .flatMap((tier) => {
      const group = byTier.get(tier)!;
      return shuffle(group.length).map((shuffledPosition) => group[shuffledPosition]);
    });
}

/** Which elements, if any, this hit was scored *against* -- the icons on
 * the losing half of the very pair that just resolved. When the TriKing
 * beats an Axe pair it should be an Axe demon that comes off the board,
 * which is only knowable from the cell the attacker beat rather than from
 * the one it scored on. Empty when the losing half is the Trifecta tile
 * (it names no single element) or when it belongs to the uniform side
 * (whose targets have no elements to prefer anyway). */
function preferredElements<TIcon extends string>(
  config: TrifectaSheetConfig<TIcon>,
  pairIndex: number,
  side: 'o' | 'x',
): TIcon[] {
  const losingCell = config.arrangement[pairIndex][side === 'o' ? 'x' : 'o'];
  if (losingCell.kind === 'trifecta') return [];
  return losingCell.symbols.filter((icon) => icon !== config.uniformIcon);
}

/**
 * Which targets a hit takes off the board, as indices into
 * config.targets[side].
 *
 * The Night's own crossOrder decides this by default -- tiers in order,
 * shuffled inside each. A hit that was scored against particular elements
 * takes those first where it can (see preferredElements), falling back to
 * crossOrder for the rest: so a two-damage hit against an Axe pair takes
 * an Axe demon and then whatever was next in line, rather than refusing
 * to spend its second point. Preference only ever reorders what's already
 * standing; it can't reach past a tier or resurrect anything.
 *
 * A hit bigger than what's left simply overkills: the Night is over
 * either way, and clamping here keeps `destroyed` from ever holding more
 * than the nine that exist.
 */
function chooseTargets<TIcon extends string>(
  config: TrifectaSheetConfig<TIcon>,
  state: TrifectaNightState<TIcon>,
  side: Side,
  damage: number,
  preferred: TIcon[],
): number[] {
  const alreadyGone = new Set(state.destroyed[side]);
  const standing = state.crossOrder[side].filter((index) => !alreadyGone.has(index));
  if (preferred.length === 0) return standing.slice(0, damage);

  const matches = standing.filter((index) => {
    const element = config.targets[side][index]?.element;
    return element !== undefined && preferred.includes(element);
  });
  const rest = standing.filter((index) => !matches.includes(index));
  return [...matches, ...rest].slice(0, damage);
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
  initNight(config, shuffle) {
    return {
      familyId: 'trifecta',
      currentRound: { roundIndex: 0, flips: [] },
      destroyed: { humans: [], demons: [] },
      activated: [],
      lastRound: null,
      crossOrder: {
        humans: crossOrderFor(config.targets.humans, shuffle),
        demons: crossOrderFor(config.targets.demons, shuffle),
      },
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

    const hits = chooseTargets(config, state, defender, damage, preferredElements(config, pairIndex, side));
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
