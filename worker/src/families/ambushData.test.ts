import { describe, expect, it } from 'vitest';
import type { CoinFace, TrifectaNightState, TrifectaSheetConfig } from '@total-tossup-live/shared';
import { trifectaEngine } from './trifecta';
import { TRIFECTA_PRESET } from '../presets';

// Ambush is TRIFECTA_SHEETS[1] -- the second Trifecta Sheet, and the first
// to put the humans on the Trifecta side. These tests cover the two things
// no other Sheet's tests touch: the inverted roles, and three characters
// at three health each expressed as ordinary targets plus tiers.
const config = TRIFECTA_PRESET.sheets[1].config as TrifectaSheetConfig;

/** A deterministic stand-in for the coordinator's own Fisher-Yates
 * shuffle: leaves order alone, so these assertions can name exact target
 * indices instead of describing a distribution. */
const noShuffle = (n: number) => Array.from({ length: n }, (_, i) => i);

// Worked out against AMBUSH_ARRANGEMENT. The first three flips pick the
// pair (heads = 1, most significant first) and the fourth picks the side
// (heads = X).
const T = 'tails' as CoinFace;
const H = 'heads' as CoinFace;
const SHOTGUN_FLIPS = [T, H, T, H]; // pair 2 (OXO), X side -- lone shotgun
const HAMMER_FLIPS = [T, H, H, T]; // pair 3 (OXX), O side -- lone hammer
const GUNS_FLIPS = [H, T, T, H]; // pair 4 (XOO), X side -- lone guns
const SWARM_ONE_FLIPS = [T, H, H, H]; // pair 3 (OXX), X side -- one demonface
const SWARM_TWO_FLIPS = [H, H, T, H]; // pair 6 (XXO), X side -- two demonfaces
const TILE_FLIPS = [T, T, T, H]; // pair 0 (OOO), X side -- the Trifecta tile

function playRound(state: TrifectaNightState, faces: CoinFace[]) {
  let current = state;
  let last: ReturnType<typeof trifectaEngine.applyFlip> | undefined;
  for (const face of faces) {
    last = trifectaEngine.applyFlip(current, config, face);
    current = last.state;
    if (last.roundClosed) break;
  }
  return last!;
}

describe('Ambush arrangement', () => {
  const cells = Object.values(config.arrangement);

  it('gives both sides exactly nine targets', () => {
    expect(config.targets.humans).toHaveLength(9);
    expect(config.targets.demons).toHaveLength(9);
  });

  it('puts the humans on the Trifecta side with the swarm as the uniform force', () => {
    expect(config.trifectaSide).toBe('humans');
    expect(config.uniformIcon).toBe('demonface');
    expect(config.elements).toEqual(['hammer', 'guns', 'shotgun']);
  });

  it('holds each element in exactly 3 of the 16 cells', () => {
    const counts: Record<string, number> = { hammer: 0, guns: 0, shotgun: 0 };
    for (const pair of cells) {
      for (const cell of [pair.o, pair.x]) {
        if (cell.kind !== 'symbols') continue;
        for (const icon of new Set(cell.symbols)) {
          if (icon in counts) counts[icon] += 1;
        }
      }
    }
    expect(counts).toEqual({ hammer: 3, guns: 3, shotgun: 3 });
  });

  it('holds the uniform swarm across 8 cells with 13 symbols between them', () => {
    let cellCount = 0;
    let symbolCount = 0;
    for (const pair of cells) {
      for (const cell of [pair.o, pair.x]) {
        if (cell.kind !== 'symbols') continue;
        const swarm = cell.symbols.filter((icon) => icon === 'demonface');
        if (swarm.length > 0) cellCount += 1;
        symbolCount += swarm.length;
      }
    }
    // The same split KingHuman uses, which is what makes the uniform side
    // faster early and the Trifecta side faster once the tile is lit.
    expect(cellCount).toBe(8);
    expect(symbolCount).toBe(13);
  });

  it('puts the tile on two cells that straddle the centre line', () => {
    expect(config.arrangement[0].x.kind).toBe('trifecta');
    expect(config.arrangement[1].o.kind).toBe('trifecta');
    // Each straddled pair keeps its other cell for the uniform side, so
    // the final flip is still a genuine 50/50.
    expect(config.arrangement[0].o.kind).toBe('symbols');
    expect(config.arrangement[1].x.kind).toBe('symbols');
  });
});

describe('Ambush: three humans at three health each', () => {
  it('orders every human wound before any KO -- Joshua\'s "final standoff"', () => {
    const state = trifectaEngine.initNight(config, noShuffle);
    // Tier 0 is the three first wounds, tier 1 the three second wounds,
    // tier 2 the three KOs -- so the KO indices (2, 5, 8) must all land
    // in the last three positions no matter how the shuffle falls.
    expect(state.crossOrder.humans.slice(0, 3).sort()).toEqual([0, 3, 6]);
    expect(state.crossOrder.humans.slice(3, 6).sort()).toEqual([1, 4, 7]);
    expect(state.crossOrder.humans.slice(6, 9).sort()).toEqual([2, 5, 8]);
  });

  it('keeps the tier boundaries under a real shuffle, not just the identity one', () => {
    const reverseShuffle = (n: number) => Array.from({ length: n }, (_, i) => n - 1 - i);
    const state = trifectaEngine.initNight(config, reverseShuffle);
    expect(state.crossOrder.humans.slice(0, 3).sort()).toEqual([0, 3, 6]);
    expect(state.crossOrder.humans.slice(6, 9).sort()).toEqual([2, 5, 8]);
  });

  it('takes nine hits to wipe the humans out, and the last three are the KOs', () => {
    let state = trifectaEngine.initNight(config, noShuffle);
    let outcome: ReturnType<typeof trifectaEngine.applyFlip> | undefined;

    for (let i = 0; i < 9; i += 1) {
      outcome = playRound(state, SWARM_ONE_FLIPS);
      if (i < 8) {
        expect(outcome.nightWinner).toBeNull();
        state = trifectaEngine.startNextRound(outcome.state);
      }
    }

    expect(outcome!.nightWinner).toBe('demons');
    expect(outcome!.state.destroyed.humans).toHaveLength(9);
    expect(outcome!.state.destroyed.humans.slice(6).sort()).toEqual([2, 5, 8]);
  });
});

describe('Ambush: the swarm and the elements', () => {
  it('scores human elements against the demons and the swarm against the humans', () => {
    const shotgun = playRound(trifectaEngine.initNight(config, noShuffle), SHOTGUN_FLIPS);
    expect(shotgun.roundWinner).toBe('humans');
    expect(shotgun.state.destroyed.demons).toHaveLength(1);

    const swarm = playRound(trifectaEngine.initNight(config, noShuffle), SWARM_TWO_FLIPS);
    expect(swarm.roundWinner).toBe('demons');
    expect(swarm.state.destroyed.humans).toHaveLength(2);
  });

  it('kills one demon per hit -- the swarm has no tiers to work through', () => {
    const outcome = playRound(trifectaEngine.initNight(config, noShuffle), SHOTGUN_FLIPS);
    expect(outcome.state.destroyed.demons).toEqual([0]);
  });

  it('charges the tile as each human weapon shows up, and deals that much', () => {
    let state = trifectaEngine.initNight(config, noShuffle);

    // Cold tile: nothing has been activated, so it deals nothing. The
    // designed quiet pause rather than a special case.
    const cold = playRound(state, TILE_FLIPS);
    expect(cold.state.activated).toEqual([]);
    expect(cold.roundWinner).toBeNull();
    expect(cold.state.destroyed.demons).toHaveLength(0);
    state = trifectaEngine.startNextRound(cold.state);

    for (const flips of [HAMMER_FLIPS, GUNS_FLIPS, SHOTGUN_FLIPS]) {
      const outcome = playRound(state, flips);
      state = trifectaEngine.startNextRound(outcome.state);
    }
    expect([...state.activated].sort()).toEqual(['guns', 'hammer', 'shotgun']);

    // All three lit: the tile now hits for 3, on top of the 3 demons the
    // activating rounds already took.
    const hot = playRound(state, TILE_FLIPS);
    expect(hot.roundWinner).toBe('humans');
    expect(hot.state.destroyed.demons).toHaveLength(6);
    expect(hot.pauseScale).toBe(3);
  });
});
