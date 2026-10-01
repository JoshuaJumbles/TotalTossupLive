import { describe, expect, it } from 'vitest';
import type { CoinFace, TrifectaNightState, TrifectaSheetConfig } from '@total-tossup-live/shared';
import { trifectaEngine } from './trifecta';
import { TRIFECTA_PRESET } from '../presets';

// Tentacle Pit is TRIFECTA_SHEETS[3]. Its grid export was missing the
// layer that draws the tile's box, so the arrangement here rests on
// Joshua's correction (second row down, straddling the centre) plus the
// structural check below -- which is the real reason to trust it, since
// the element counts only come out right one way.
const config = TRIFECTA_PRESET.sheets[3].config as TrifectaSheetConfig;

const noShuffle = (n: number) => Array.from({ length: n }, (_, i) => i);

const T = 'tails' as CoinFace;
const H = 'heads' as CoinFace;
// The first three flips pick the pair (heads = 1, most significant
// first), the fourth picks the side. The humans field drill/claw/gun
// here, so one of those cells damages the tentacles, and a demonface cell
// damages the ship.
const DRILL_SCORES = [H, H, T, T]; // pair 6 (XXO), O -- lone drill
const GUN_SCORES = [H, H, H, T]; // pair 7 (XXX), O -- lone gun
const CLAW_SCORES = [T, H, T, H]; // pair 2 (OXO), X -- lone claw
const BEAST_ONE = [H, H, T, H]; // pair 6 (XXO), X -- one demonface, 1 on the ship
const TILE_FLIPS = [H, T, T, H]; // pair 4 (XOO), X -- the Trifecta tile

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

describe('Tentacle Pit arrangement', () => {
  const cells = Object.values(config.arrangement);

  it('gives both sides exactly nine targets, with the humans fielding the variety', () => {
    expect(config.targets.humans).toHaveLength(9);
    expect(config.targets.demons).toHaveLength(9);
    expect(config.trifectaSide).toBe('humans');
    expect(config.uniformIcon).toBe('demonface');
    expect(config.elements).toEqual(['drill', 'claw', 'gun']);
  });

  it('holds each element in exactly 3 of the 16 cells', () => {
    // This is the assertion that pins down where the tile goes. Reading
    // the tile's two cells as ordinary symbol cells instead would give 4
    // apiece, so this failing means the tile has been misplaced.
    const counts: Record<string, number> = { drill: 0, claw: 0, gun: 0 };
    for (const pair of cells) {
      for (const cell of [pair.o, pair.x]) {
        if (cell.kind !== 'symbols') continue;
        for (const icon of new Set(cell.symbols)) {
          if (icon in counts) counts[icon] += 1;
        }
      }
    }
    expect(counts).toEqual({ drill: 3, claw: 3, gun: 3 });
  });

  it('covers each distinct pairing exactly once across the two-element cells', () => {
    const pairings = new Set<string>();
    let twoElementCells = 0;
    for (const pair of cells) {
      for (const cell of [pair.o, pair.x]) {
        if (cell.kind !== 'symbols') continue;
        const elements = cell.symbols.filter((i) => i !== 'demonface');
        if (elements.length === 2) {
          twoElementCells += 1;
          pairings.add([...elements].sort().join('+'));
        }
      }
    }
    expect(twoElementCells).toBe(3);
    expect([...pairings].sort()).toEqual(['claw+drill', 'claw+gun', 'drill+gun']);
  });

  it('holds the uniform beast across 8 cells with 13 symbols between them', () => {
    let cellCount = 0;
    let symbolCount = 0;
    for (const pair of cells) {
      for (const cell of [pair.o, pair.x]) {
        if (cell.kind !== 'symbols') continue;
        const beast = cell.symbols.filter((icon) => icon === 'demonface');
        if (beast.length > 0) cellCount += 1;
        symbolCount += beast.length;
      }
    }
    expect(cellCount).toBe(8);
    expect(symbolCount).toBe(13);
  });

  it('puts the tile on the second row down, straddling the centre line', () => {
    expect(config.arrangement[4].x.kind).toBe('trifecta');
    expect(config.arrangement[5].o.kind).toBe('trifecta');
    expect(config.arrangement[4].o.kind).toBe('symbols');
    expect(config.arrangement[5].x.kind).toBe('symbols');
  });
});

describe('Tentacle Pit: the Tripod comes apart from the outside in', () => {
  it('orders the three elbows, then the five tools, then the hull', () => {
    const state = trifectaEngine.initNight(config, noShuffle);
    expect(state.crossOrder.humans.slice(0, 3).sort()).toEqual([0, 1, 2]);
    expect(state.crossOrder.humans.slice(3, 8).sort()).toEqual([3, 4, 5, 6, 7]);
    expect(state.crossOrder.humans[8]).toBe(8);
  });

  it('keeps that ladder under a real shuffle, not just the identity one', () => {
    const reverseShuffle = (n: number) => Array.from({ length: n }, (_, i) => n - 1 - i);
    const state = trifectaEngine.initNight(config, reverseShuffle);
    expect(state.crossOrder.humans.slice(0, 3).sort()).toEqual([0, 1, 2]);
    expect(state.crossOrder.humans.slice(3, 8).sort()).toEqual([3, 4, 5, 6, 7]);
    expect(state.crossOrder.humans[8]).toBe(8);
  });

  it('needs all nine hits to take the ship, ending on the hull', () => {
    let state = trifectaEngine.initNight(config, noShuffle);
    let outcome: ReturnType<typeof trifectaEngine.applyFlip> | undefined;
    for (let i = 0; i < 9; i += 1) {
      outcome = playRound(state, BEAST_ONE);
      if (i < 8) {
        expect(outcome.nightWinner).toBeNull();
        state = trifectaEngine.startNextRound(outcome.state);
      }
    }
    expect(outcome!.nightWinner).toBe('demons');
    expect(outcome!.state.destroyed.humans.at(-1)).toBe(8);
  });
});

describe('Tentacle Pit: tentacles and the tile', () => {
  it('takes tentacles in the Night\'s own order, with nothing thematic to prefer', () => {
    const outcome = playRound(trifectaEngine.initNight(config, noShuffle), CLAW_SCORES);
    expect(outcome.roundWinner).toBe('humans');
    expect(outcome.state.destroyed.demons).toEqual([0]);
  });

  it('charges the tile as each tool shows up, and deals that much to the beast', () => {
    let state = trifectaEngine.initNight(config, noShuffle);

    const cold = playRound(state, TILE_FLIPS);
    expect(cold.state.activated).toEqual([]);
    expect(cold.roundWinner).toBeNull();
    expect(cold.state.destroyed.demons).toHaveLength(0);
    state = trifectaEngine.startNextRound(cold.state);

    for (const flips of [DRILL_SCORES, CLAW_SCORES, GUN_SCORES]) {
      const outcome = playRound(state, flips);
      state = trifectaEngine.startNextRound(outcome.state);
    }
    expect([...state.activated].sort()).toEqual(['claw', 'drill', 'gun']);

    // The tile belongs to the Trifecta side, which is the humans here, so
    // a charged tile lands on the tentacles -- three at once, on top of
    // the three the activating rounds already took.
    const hot = playRound(state, TILE_FLIPS);
    expect(hot.roundWinner).toBe('humans');
    expect(hot.state.destroyed.demons).toHaveLength(6);
    expect(hot.pauseScale).toBe(3);
  });
});
