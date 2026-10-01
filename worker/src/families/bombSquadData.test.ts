import { describe, expect, it } from 'vitest';
import type { CoinFace, TrifectaNightState, TrifectaSheetConfig } from '@total-tossup-live/shared';
import { trifectaEngine } from './trifecta';
import { TRIFECTA_PRESET } from '../presets';

// Bomb Squad is TRIFECTA_SHEETS[2]. These tests cover what's specific to
// it: a three-step human tier ladder of uneven sizes (6 wall / 2 launchers
// / 1 Holder), and thematic targeting on the demon side -- which this
// Sheet can have precisely because its demons carry no tiers for an
// element match to jump ahead of (see ambushData.ts).
const config = TRIFECTA_PRESET.sheets[2].config as TrifectaSheetConfig;

const noShuffle = (n: number) => Array.from({ length: n }, (_, i) => i);

const T = 'tails' as CoinFace;
const H = 'heads' as CoinFace;
// Worked out against BOMBSQUAD_ARRANGEMENT: the first three flips pick
// the pair (heads = 1, most significant first), the fourth picks the
// side. Which side SCORES follows from who owns the icons -- the demons
// field small/medium/large here, so one of those cells damages the
// humans, and a bomb cell damages the demons.
const SMALL_SCORES = [H, T, T, T]; // pair 4 (XOO), O -- lone small, 1 on the humans
const MEDIUM_SCORES = [T, H, T, H]; // pair 2 (OXO), X -- lone medium, 1 on the humans
const LARGE_SCORES = [H, T, H, H]; // pair 5 (XOX), X -- lone large, 1 on the humans
const TILE_FLIPS = [H, H, T, H]; // pair 6 (XXO), X -- the Trifecta tile, demon-owned

// Bomb cells, named by what sits in the pair's OTHER half -- which is what
// preferredElements reads to pick which demon takes the hit.
const BOMBS_VS_MEDIUM = [T, H, T, T]; // pair 2 (OXO), O -- 2 bombs, loser holds medium
const BOMBS_VS_LARGE = [H, T, H, T]; // pair 5 (XOX), O -- 2 bombs, loser holds large
const BOMB_VS_SMALL = [H, T, T, H]; // pair 4 (XOO), X -- 1 bomb, loser holds small

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

describe('Bomb Squad arrangement', () => {
  const cells = Object.values(config.arrangement);

  it('gives both sides exactly nine targets, with the demons fielding the variety', () => {
    expect(config.targets.humans).toHaveLength(9);
    expect(config.targets.demons).toHaveLength(9);
    expect(config.trifectaSide).toBe('demons');
    expect(config.uniformIcon).toBe('bomb');
    expect(config.elements).toEqual(['small', 'medium', 'large']);
  });

  it('holds each element in exactly 3 of the 16 cells', () => {
    const counts: Record<string, number> = { small: 0, medium: 0, large: 0 };
    for (const pair of cells) {
      for (const cell of [pair.o, pair.x]) {
        if (cell.kind !== 'symbols') continue;
        for (const icon of new Set(cell.symbols)) {
          if (icon in counts) counts[icon] += 1;
        }
      }
    }
    expect(counts).toEqual({ small: 3, medium: 3, large: 3 });
  });

  it('holds the uniform bombs across 8 cells with 13 symbols between them', () => {
    let cellCount = 0;
    let symbolCount = 0;
    for (const pair of cells) {
      for (const cell of [pair.o, pair.x]) {
        if (cell.kind !== 'symbols') continue;
        const bombs = cell.symbols.filter((icon) => icon === 'bomb');
        if (bombs.length > 0) cellCount += 1;
        symbolCount += bombs.length;
      }
    }
    // The same 8/13 split KingHuman and Ambush use -- three Sheets in,
    // this is the Family's rule rather than one Sheet's quirk.
    expect(cellCount).toBe(8);
    expect(symbolCount).toBe(13);
  });

  it('puts the tile on the top row, still straddling the centre line', () => {
    expect(config.arrangement[6].x.kind).toBe('trifecta');
    expect(config.arrangement[7].o.kind).toBe('trifecta');
    expect(config.arrangement[6].o.kind).toBe('symbols');
    expect(config.arrangement[7].x.kind).toBe('symbols');
  });
});

describe('Bomb Squad: the position falls from the wall inwards', () => {
  it('orders the six wall segments, then the launchers, then the Holder', () => {
    const state = trifectaEngine.initNight(config, noShuffle);
    expect(state.crossOrder.humans.slice(0, 6).sort()).toEqual([0, 1, 2, 3, 4, 5]);
    expect(state.crossOrder.humans.slice(6, 8).sort()).toEqual([6, 7]);
    // The Holder is the final kill, the way KingHuman's torso is.
    expect(state.crossOrder.humans[8]).toBe(8);
  });

  it('keeps that ladder under a real shuffle, not just the identity one', () => {
    const reverseShuffle = (n: number) => Array.from({ length: n }, (_, i) => n - 1 - i);
    const state = trifectaEngine.initNight(config, reverseShuffle);
    expect(state.crossOrder.humans.slice(0, 6).sort()).toEqual([0, 1, 2, 3, 4, 5]);
    expect(state.crossOrder.humans.slice(6, 8).sort()).toEqual([6, 7]);
    expect(state.crossOrder.humans[8]).toBe(8);
  });

  it('needs all nine hits to take the position, ending on the Holder', () => {
    let state = trifectaEngine.initNight(config, noShuffle);
    let outcome: ReturnType<typeof trifectaEngine.applyFlip> | undefined;
    for (let i = 0; i < 9; i += 1) {
      outcome = playRound(state, SMALL_SCORES);
      if (i < 8) {
        expect(outcome.nightWinner).toBeNull();
        state = trifectaEngine.startNextRound(outcome.state);
      }
    }
    expect(outcome!.nightWinner).toBe('demons');
    expect(outcome!.state.destroyed.humans.at(-1)).toBe(8);
  });
});

describe('Bomb Squad: thematic targeting on the demons', () => {
  it('takes a demon of the size the humans scored against', () => {
    // Indices 0-2 are the smalls, 3-5 the mediums, 6-8 the big one's eyes.
    const medium = playRound(trifectaEngine.initNight(config, noShuffle), BOMBS_VS_MEDIUM);
    expect(medium.roundWinner).toBe('humans');
    expect(medium.state.destroyed.demons).toEqual([3, 4]);

    const large = playRound(trifectaEngine.initNight(config, noShuffle), BOMBS_VS_LARGE);
    expect(large.state.destroyed.demons).toEqual([6, 7]);

    const small = playRound(trifectaEngine.initNight(config, noShuffle), BOMB_VS_SMALL);
    expect(small.state.destroyed.demons).toEqual([0]);
  });

  it('falls back to the running order once that size is gone', () => {
    let state = trifectaEngine.initNight(config, noShuffle);
    // Two rounds of 2 damage each, aimed at the mediums: the first clears
    // two of them, the second takes the last one and then spills over,
    // since only three mediums exist.
    for (let i = 0; i < 2; i += 1) {
      const outcome = playRound(state, BOMBS_VS_MEDIUM);
      state = trifectaEngine.startNextRound(outcome.state);
    }
    expect(state.destroyed.demons).toHaveLength(4);
    expect(state.destroyed.demons).toEqual(expect.arrayContaining([3, 4, 5]));
    // The spillover is whatever came next in the Night's own order, rather
    // than the hit being wasted.
    expect(state.destroyed.demons).toContain(0);
  });

  it('charges the tile as each size shows up, and deals that much', () => {
    let state = trifectaEngine.initNight(config, noShuffle);

    const cold = playRound(state, TILE_FLIPS);
    expect(cold.state.activated).toEqual([]);
    expect(cold.roundWinner).toBeNull();
    expect(cold.state.destroyed.humans).toHaveLength(0);
    state = trifectaEngine.startNextRound(cold.state);

    for (const flips of [SMALL_SCORES, MEDIUM_SCORES, LARGE_SCORES]) {
      const outcome = playRound(state, flips);
      state = trifectaEngine.startNextRound(outcome.state);
    }
    expect([...state.activated].sort()).toEqual(['large', 'medium', 'small']);

    // The tile belongs to the Trifecta side, which is the demons here, so
    // a charged tile lands on the humans -- three wall segments at once,
    // on top of the three the activating rounds already took.
    const hot = playRound(state, TILE_FLIPS);
    expect(hot.roundWinner).toBe('demons');
    expect(hot.state.destroyed.humans).toHaveLength(6);
    expect(hot.pauseScale).toBe(3);
  });
});
