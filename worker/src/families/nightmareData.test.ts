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

const config = sheetConfig('nightmare');

const noShuffle = (n: number) => Array.from({ length: n }, (_, i) => i);

const T = 'tails' as CoinFace;
const H = 'heads' as CoinFace;
// First three flips pick the pair (heads = 1, most significant first), the
// fourth picks the side. The demons field scream/hand/demon here, so one
// of those cells damages the wizards' side and a star cell damages the
// onslaught.
const SCREAM_SCORES = [T, H, T, T]; // pair 2 (OXO), O -- lone scream
const HAND_SCORES = [T, H, H, H]; // pair 3 (OXX), X -- lone hand
const DEMON_SCORES = [T, T, T, H]; // pair 0 (OOO), X -- lone demon
// Star cells named by what sits in the pair's OTHER half, which is what
// preferredElements reads to steer the hit. Each of these has exactly one
// kind in its losing half, so the assertion is unambiguous.
const STAR_VS_DEMON = [T, T, T, T]; // pair 0 (OOO), O -- 1 star, loser is demon
const STARS_VS_SCREAM = [T, H, T, H]; // pair 2 (OXO), X -- 2 stars, loser is scream
const STARS_VS_HAND = [T, H, H, T]; // pair 3 (OXX), O -- 2 stars, loser is hand
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

describe('Nightmare arrangement', () => {
  const cells = Object.values(config.arrangement);

  it('gives both sides exactly nine targets, with the demons fielding the variety', () => {
    expect(config.targets.humans).toHaveLength(9);
    expect(config.targets.demons).toHaveLength(9);
    expect(config.trifectaSide).toBe('demons');
    expect(config.uniformIcon).toBe('star');
    expect([...config.elements].sort()).toEqual(['demon', 'hand', 'scream']);
  });

  it('holds each element in exactly 3 of the 16 cells', () => {
    const counts: Record<string, number> = { scream: 0, hand: 0, demon: 0 };
    for (const pair of cells) {
      for (const cell of [pair.o, pair.x]) {
        if (cell.kind !== 'symbols') continue;
        for (const icon of new Set(cell.symbols)) {
          if (icon in counts) counts[icon] += 1;
        }
      }
    }
    expect(counts).toEqual({ scream: 3, hand: 3, demon: 3 });
  });

  it('covers each distinct pairing exactly once across the two-element cells', () => {
    const pairings = new Set<string>();
    let twoElementCells = 0;
    for (const pair of cells) {
      for (const cell of [pair.o, pair.x]) {
        if (cell.kind !== 'symbols') continue;
        const elements = cell.symbols.filter((i) => i !== 'star');
        if (elements.length === 2) {
          twoElementCells += 1;
          pairings.add([...elements].sort().join('+'));
        }
      }
    }
    expect(twoElementCells).toBe(3);
    expect([...pairings].sort()).toEqual(['demon+hand', 'demon+scream', 'hand+scream']);
  });

  it('holds the uniform shield across 8 cells with 13 symbols between them', () => {
    let cellCount = 0;
    let symbolCount = 0;
    for (const pair of cells) {
      for (const cell of [pair.o, pair.x]) {
        if (cell.kind !== 'symbols') continue;
        const stars = cell.symbols.filter((icon) => icon === 'star');
        if (stars.length > 0) cellCount += 1;
        symbolCount += stars.length;
      }
    }
    expect(cellCount).toBe(8);
    expect(symbolCount).toBe(13);
  });

  it('puts the tile on the second row, straddling the centre line', () => {
    expect(config.arrangement[4].x.kind).toBe('trifecta');
    expect(config.arrangement[5].o.kind).toBe('trifecta');
    expect(config.arrangement[4].o.kind).toBe('symbols');
    expect(config.arrangement[5].x.kind).toBe('symbols');
  });
});

describe('Nightmare: the shield goes before the wizards', () => {
  it('breaks all six shield segments before touching a wizard', () => {
    const state = trifectaEngine.initNight(config, noShuffle);
    expect(state.crossOrder.humans.slice(0, 6).sort()).toEqual([0, 1, 2, 3, 4, 5]);
    expect(state.crossOrder.humans.slice(6, 9).sort()).toEqual([6, 7, 8]);
  });

  it('keeps that split under a real shuffle, not just the identity one', () => {
    const reverseShuffle = (n: number) => Array.from({ length: n }, (_, i) => n - 1 - i);
    const state = trifectaEngine.initNight(config, reverseShuffle);
    expect(state.crossOrder.humans.slice(0, 6).sort()).toEqual([0, 1, 2, 3, 4, 5]);
    expect(state.crossOrder.humans.slice(6, 9).sort()).toEqual([6, 7, 8]);
  });

  it('needs all nine hits, the last three being the wizards themselves', () => {
    let state = trifectaEngine.initNight(config, noShuffle);
    let outcome: ReturnType<typeof trifectaEngine.applyFlip> | undefined;
    for (let i = 0; i < 9; i += 1) {
      outcome = playRound(state, SCREAM_SCORES);
      if (i < 8) {
        expect(outcome.nightWinner).toBeNull();
        state = trifectaEngine.startNextRound(outcome.state);
      }
    }
    expect(outcome!.nightWinner).toBe('demons');
    expect(outcome!.state.destroyed.humans.slice(6).sort()).toEqual([6, 7, 8]);
  });
});

describe('Nightmare: the onslaught is targeted by theme', () => {
  // Indices 0-2 are the skulls, 3-5 the hands, 6-8 the spiral demons.
  it('takes an entity of the kind the shield scored against', () => {
    const demon = playRound(trifectaEngine.initNight(config, noShuffle), STAR_VS_DEMON);
    expect(demon.roundWinner).toBe('humans');
    expect(demon.state.destroyed.demons).toEqual([6]);

    const scream = playRound(trifectaEngine.initNight(config, noShuffle), STARS_VS_SCREAM);
    expect(scream.state.destroyed.demons).toEqual([0, 1]);

    const hand = playRound(trifectaEngine.initNight(config, noShuffle), STARS_VS_HAND);
    expect(hand.state.destroyed.demons).toEqual([3, 4]);
  });

  it('falls back to the running order once a kind is exhausted', () => {
    let state = trifectaEngine.initNight(config, noShuffle);
    // Two rounds of 2 damage aimed at the hands: the first clears two, the
    // second takes the last one and then spills over, since only three
    // hands exist.
    for (let i = 0; i < 2; i += 1) {
      const outcome = playRound(state, STARS_VS_HAND);
      state = trifectaEngine.startNextRound(outcome.state);
    }
    expect(state.destroyed.demons).toHaveLength(4);
    expect(state.destroyed.demons).toEqual(expect.arrayContaining([3, 4, 5]));
    // The spillover went to the Night's own order rather than being wasted.
    expect(state.destroyed.demons).toContain(0);
  });

  it('charges the tile as each kind shows up, then hits the shield for three', () => {
    let state = trifectaEngine.initNight(config, noShuffle);

    const cold = playRound(state, TILE_FLIPS);
    expect(cold.state.activated).toEqual([]);
    expect(cold.roundWinner).toBeNull();
    expect(cold.state.destroyed.humans).toHaveLength(0);
    state = trifectaEngine.startNextRound(cold.state);

    for (const flips of [SCREAM_SCORES, HAND_SCORES, DEMON_SCORES]) {
      const outcome = playRound(state, flips);
      state = trifectaEngine.startNextRound(outcome.state);
    }
    expect([...state.activated].sort()).toEqual(['demon', 'hand', 'scream']);

    // The tile belongs to the Trifecta side, the demons here, so a charged
    // tile lands on the wizards' shield.
    const hot = playRound(state, TILE_FLIPS);
    expect(hot.roundWinner).toBe('demons');
    expect(hot.state.destroyed.humans).toHaveLength(6);
    expect(hot.pauseScale).toBe(3);
  });
});
