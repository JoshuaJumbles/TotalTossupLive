import { describe, expect, it } from 'vitest';
import type { CoinFace, TrifectaNightState, TrifectaSheetConfig } from '@total-tossup-live/shared';
import { trifectaEngine } from './trifecta';
import { TRIFECTA_PRESET } from '../presets';

/** Looked up by id rather than by position: TRIFECTA_SHEETS is a playlist
 * whose order changes whenever a new Sheet goes to the front for review,
 * and a test silently pointing at a different Sheet is worse than one that
 * fails. */
function sheetConfig(id: string): TrifectaSheetConfig {
  const sheet = TRIFECTA_PRESET.sheets.find((s) => s.id === id);
  if (!sheet) throw new Error(`No Trifecta Sheet with id "${id}"`);
  return sheet.config as TrifectaSheetConfig;
}

const config = sheetConfig('demonking');

const noShuffle = (n: number) => Array.from({ length: n }, (_, i) => i);

const T = 'tails' as CoinFace;
const H = 'heads' as CoinFace;
// First three flips pick the pair (heads = 1, most significant first), the
// fourth picks the side. The humans field bow/swords/fork here, so one of
// those cells damages the King and a demonface cell damages the fighters.
const BOW_SCORES = [H, H, T, T]; // pair 6 (XXO), O -- lone bow
const SWORDS_SCORES = [H, T, H, T]; // pair 5 (XOX), O -- lone swords
const FORK_SCORES = [T, T, T, T]; // pair 0 (OOO), O -- lone fork
const KING_ONE = [H, T, T, H]; // pair 4 (XOO), X -- one demonface
const TILE_FLIPS = [T, H, T, H]; // pair 2 (OXO), X -- the Trifecta tile

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

describe('Demon King arrangement', () => {
  const cells = Object.values(config.arrangement);

  it('gives both sides exactly nine targets, with the humans fielding the variety', () => {
    expect(config.targets.humans).toHaveLength(9);
    expect(config.targets.demons).toHaveLength(9);
    expect(config.trifectaSide).toBe('humans');
    expect(config.uniformIcon).toBe('demonface');
    expect([...config.elements].sort()).toEqual(['bow', 'fork', 'swords']);
  });

  it('holds each element in exactly 3 of the 16 cells', () => {
    const counts: Record<string, number> = { bow: 0, swords: 0, fork: 0 };
    for (const pair of cells) {
      for (const cell of [pair.o, pair.x]) {
        if (cell.kind !== 'symbols') continue;
        for (const icon of new Set(cell.symbols)) {
          if (icon in counts) counts[icon] += 1;
        }
      }
    }
    expect(counts).toEqual({ bow: 3, swords: 3, fork: 3 });
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
    expect([...pairings].sort()).toEqual(['bow+fork', 'bow+swords', 'fork+swords']);
  });

  it('holds the uniform King across 8 cells with 13 symbols between them', () => {
    let cellCount = 0;
    let symbolCount = 0;
    for (const pair of cells) {
      for (const cell of [pair.o, pair.x]) {
        if (cell.kind !== 'symbols') continue;
        const king = cell.symbols.filter((icon) => icon === 'demonface');
        if (king.length > 0) cellCount += 1;
        symbolCount += king.length;
      }
    }
    expect(cellCount).toBe(8);
    expect(symbolCount).toBe(13);
  });

  it('puts the tile on the third row, straddling the centre line', () => {
    expect(config.arrangement[2].x.kind).toBe('trifecta');
    expect(config.arrangement[3].o.kind).toBe('trifecta');
    expect(config.arrangement[2].o.kind).toBe('symbols');
    expect(config.arrangement[3].x.kind).toBe('symbols');
  });
});

describe('Demon King: both sides are bodies, not nine separate things', () => {
  it('wounds every fighter fully before any goes down', () => {
    const state = trifectaEngine.initNight(config, noShuffle);
    // Tier 0 is the three first wounds, tier 1 the three second wounds,
    // tier 2 the three KOs -- so the KO indices (2, 5, 8) all land in the
    // last three positions however the shuffle falls.
    expect(state.crossOrder.humans.slice(0, 3).sort()).toEqual([0, 3, 6]);
    expect(state.crossOrder.humans.slice(3, 6).sort()).toEqual([1, 4, 7]);
    expect(state.crossOrder.humans.slice(6, 9).sort()).toEqual([2, 5, 8]);
  });

  it('takes the King apart arms, then claws, then the King himself', () => {
    const state = trifectaEngine.initNight(config, noShuffle);
    expect(state.crossOrder.demons.slice(0, 4).sort()).toEqual([0, 1, 2, 3]);
    expect(state.crossOrder.demons.slice(4, 8).sort()).toEqual([4, 5, 6, 7]);
    expect(state.crossOrder.demons[8]).toBe(8);
  });

  it('keeps both ladders under a real shuffle, not just the identity one', () => {
    const reverseShuffle = (n: number) => Array.from({ length: n }, (_, i) => n - 1 - i);
    const state = trifectaEngine.initNight(config, reverseShuffle);
    expect(state.crossOrder.humans.slice(6, 9).sort()).toEqual([2, 5, 8]);
    expect(state.crossOrder.demons.slice(0, 4).sort()).toEqual([0, 1, 2, 3]);
    expect(state.crossOrder.demons[8]).toBe(8);
  });

  it('needs nine hits to drop the fighters, the last three being the KOs', () => {
    let state = trifectaEngine.initNight(config, noShuffle);
    let outcome: ReturnType<typeof trifectaEngine.applyFlip> | undefined;
    for (let i = 0; i < 9; i += 1) {
      outcome = playRound(state, KING_ONE);
      if (i < 8) {
        expect(outcome.nightWinner).toBeNull();
        state = trifectaEngine.startNextRound(outcome.state);
      }
    }
    expect(outcome!.nightWinner).toBe('demons');
    expect(outcome!.state.destroyed.humans.slice(6).sort()).toEqual([2, 5, 8]);
  });

  it('needs nine hits to drop the King, ending on the King himself', () => {
    let state = trifectaEngine.initNight(config, noShuffle);
    let outcome: ReturnType<typeof trifectaEngine.applyFlip> | undefined;
    for (let i = 0; i < 9; i += 1) {
      outcome = playRound(state, FORK_SCORES);
      if (i < 8) {
        expect(outcome.nightWinner).toBeNull();
        state = trifectaEngine.startNextRound(outcome.state);
      }
    }
    expect(outcome!.nightWinner).toBe('humans');
    expect(outcome!.state.destroyed.demons.at(-1)).toBe(8);
  });
});

describe('Demon King: the tile', () => {
  it('charges as each weapon shows up, then hits the King for three', () => {
    let state = trifectaEngine.initNight(config, noShuffle);

    const cold = playRound(state, TILE_FLIPS);
    expect(cold.state.activated).toEqual([]);
    expect(cold.roundWinner).toBeNull();
    expect(cold.state.destroyed.demons).toHaveLength(0);
    state = trifectaEngine.startNextRound(cold.state);

    for (const flips of [BOW_SCORES, SWORDS_SCORES, FORK_SCORES]) {
      const outcome = playRound(state, flips);
      state = trifectaEngine.startNextRound(outcome.state);
    }
    expect([...state.activated].sort()).toEqual(['bow', 'fork', 'swords']);

    const hot = playRound(state, TILE_FLIPS);
    expect(hot.roundWinner).toBe('humans');
    expect(hot.state.destroyed.demons).toHaveLength(6);
    expect(hot.pauseScale).toBe(3);
  });
});
