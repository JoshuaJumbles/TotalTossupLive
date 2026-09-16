import { describe, expect, it } from 'vitest';
import type { CoinFace, TrifectaNightState, TrifectaSheetConfig } from '@total-tossup-live/shared';
import { trifectaEngine, TARGETS_PER_SIDE } from './trifecta';
import { TRIFECTA_PRESET } from '../presets';

// KingHuman: demons are the Trifecta side (bigflyer/axe/spitter), humans
// field the uniform TriKing -- see presets.ts's kingHumanSheet(). The
// engine itself operates on plain string icons (matching how
// families/registry.ts dispatches it at runtime), so this stays untyped to
// KingHumanIcon here, same as the engine's own signature.
const config = TRIFECTA_PRESET.sheets[0].config as TrifectaSheetConfig;

// Flip sequences worked out against KINGHUMAN_ARRANGEMENT -- these are
// Joshua's own worked example from the TrifectaGridBehaviorExample frame,
// which is the real point of this file: the walkthrough he designed and
// the engine should agree turn for turn.
const TILE_LEFT_FLIPS: CoinFace[] = ['tails', 'heads', 'tails', 'heads']; // OXOX -> pair 2, x
const AXE_FLIPS: CoinFace[] = ['tails', 'tails', 'tails', 'tails']; // OOOO -> pair 0, o
const TILE_RIGHT_FLIPS: CoinFace[] = ['tails', 'heads', 'heads', 'tails']; // OXXO -> pair 3, o
const FLYER_SPITTER_FLIPS: CoinFace[] = ['heads', 'tails', 'heads', 'tails']; // XOXO -> pair 5, o
const TRIKING_SINGLE_FLIPS: CoinFace[] = ['heads', 'heads', 'tails', 'heads']; // XXOX -> pair 6, x
const TRIKING_DOUBLE_FLIPS: CoinFace[] = ['tails', 'tails', 'tails', 'heads']; // OOOX -> pair 0, x

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

/** Plays a whole sequence of rounds, resetting between them the way the
 * coordinator's round_resolved pause does. */
function playRounds(state: TrifectaNightState, sequences: CoinFace[][]) {
  let current = state;
  let last: ReturnType<typeof trifectaEngine.applyFlip> | undefined;
  for (const faces of sequences) {
    last = playRound(current, faces);
    current = trifectaEngine.startNextRound(last.state);
  }
  return last!;
}

/** A deterministic stand-in for the coordinator's own Fisher-Yates
 * shuffle: leaves order alone, so these assertions can name exact target
 * indices instead of describing a distribution. The shuffling itself is
 * the coordinator's, and is covered where it lives. */
const noShuffle = (n: number) => Array.from({ length: n }, (_, i) => i);

describe('trifectaEngine', () => {
  it('does not close a round before all 4 flips land', () => {
    const state = trifectaEngine.initNight(config, noShuffle);
    const outcome = playRound(state, ['tails', 'tails', 'tails']);

    expect(outcome.roundClosed).toBe(false);
    expect(outcome.state.currentRound.flips).toHaveLength(3);
  });

  it('deals one damage per symbol to the other side', () => {
    const state = trifectaEngine.initNight(config, noShuffle);

    const single = playRound(state, TRIKING_SINGLE_FLIPS);
    expect(single.roundWinner).toBe('humans');
    expect(single.state.destroyed.demons).toHaveLength(1);

    const double = playRound(state, TRIKING_DOUBLE_FLIPS);
    expect(double.roundWinner).toBe('humans');
    expect(double.state.destroyed.demons).toHaveLength(2);
    // ...and nothing lands on the side that scored.
    expect(double.state.destroyed.humans).toHaveLength(0);
  });

  it('activates every element a Trifecta-side cell names, both at once for a pair', () => {
    const state = trifectaEngine.initNight(config, noShuffle);

    const axe = playRound(state, AXE_FLIPS);
    expect(axe.state.activated).toEqual(['axe']);

    const pair = playRound(state, FLYER_SPITTER_FLIPS);
    expect(new Set(pair.state.activated)).toEqual(new Set(['bigflyer', 'spitter']));
  });

  it('never activates anything from the uniform side or from the tile itself', () => {
    const state = trifectaEngine.initNight(config, noShuffle);

    expect(playRound(state, TRIKING_DOUBLE_FLIPS).state.activated).toEqual([]);
    expect(playRound(state, TILE_LEFT_FLIPS).state.activated).toEqual([]);
  });

  it('walks Joshua\'s own worked example turn for turn', () => {
    let state = trifectaEngine.initNight(config, noShuffle);

    // Turn 1 -- OXOX, the tile's left half, with nothing activated yet:
    // zero damage, and the demons do nothing.
    const turn1 = playRound(state, TILE_LEFT_FLIPS);
    expect(turn1.roundClosed).toBe(true);
    expect(turn1.state.destroyed.humans).toHaveLength(0);
    expect(turn1.roundWinner).toBeNull(); // a real whiff, not a non-event
    state = trifectaEngine.startNextRound(turn1.state);

    // Turn 2 -- OOOO, a lone Axe: 1 damage, and the tile's Axe lights up.
    const turn2 = playRound(state, AXE_FLIPS);
    expect(turn2.roundWinner).toBe('demons');
    expect(turn2.state.destroyed.humans).toHaveLength(1);
    expect(turn2.state.activated).toEqual(['axe']);
    state = trifectaEngine.startNextRound(turn2.state);

    // Turn 3 -- OXXO, the tile's right half, now worth 1 with Axe lit.
    const turn3 = playRound(state, TILE_RIGHT_FLIPS);
    expect(turn3.roundWinner).toBe('demons');
    expect(turn3.state.destroyed.humans).toHaveLength(2);
    state = trifectaEngine.startNextRound(turn3.state);

    // Turn 4 -- XOXO, Spitter + Big Flyer: 2 damage, and both light up,
    // so all three elements are now active.
    const turn4 = playRound(state, FLYER_SPITTER_FLIPS);
    expect(turn4.state.destroyed.humans).toHaveLength(4);
    expect(new Set(turn4.state.activated)).toEqual(new Set(['axe', 'bigflyer', 'spitter']));
    state = trifectaEngine.startNextRound(turn4.state);

    // Turn 5 -- the tile again, now fully charged: 3 damage at once,
    // leaving the TriKing 2 spaces from being finished off.
    const turn5 = playRound(state, TILE_LEFT_FLIPS);
    expect(turn5.state.destroyed.humans).toHaveLength(7);
    expect(TARGETS_PER_SIDE - turn5.state.destroyed.humans.length).toBe(2);
  });

  it('scales the tile 0 -> 1 -> 2 -> 3 as elements light up', () => {
    let state = trifectaEngine.initNight(config, noShuffle);
    const damageFromTile = () => {
      const before = state.destroyed.humans.length;
      const outcome = playRound(state, TILE_LEFT_FLIPS);
      return outcome.state.destroyed.humans.length - before;
    };

    expect(damageFromTile()).toBe(0);

    state = trifectaEngine.startNextRound(playRound(state, AXE_FLIPS).state);
    expect(damageFromTile()).toBe(1);

    state = trifectaEngine.startNextRound(playRound(state, FLYER_SPITTER_FLIPS).state);
    expect(damageFromTile()).toBe(3);
  });

  it('destroys the uniform side by tier, saving the final space for last', () => {
    const state = trifectaEngine.initNight(config, noShuffle);
    // Eight single-damage hits on the TriKing clears both lower tiers
    // before the lone tier-2 torso space is ever touched.
    const eightHits = playRounds(state, Array.from({ length: 8 }, () => AXE_FLIPS));

    const tiers = eightHits.state.destroyed.humans.map((index) => config.targets.humans[index].tier);
    expect(tiers.filter((tier) => tier === 0)).toHaveLength(4);
    expect(tiers.filter((tier) => tier === 1)).toHaveLength(4);
    expect(tiers).not.toContain(2);
  });

  it('ends the Night when a side loses all nine, and clamps an overkill hit', () => {
    let state = trifectaEngine.initNight(config, noShuffle);

    // Light every element so the tile is worth its full 3, then hammer
    // the TriKing until it falls.
    state = trifectaEngine.startNextRound(playRound(state, AXE_FLIPS).state);
    state = trifectaEngine.startNextRound(playRound(state, FLYER_SPITTER_FLIPS).state);
    expect(state.destroyed.humans).toHaveLength(3);

    // 3 + 3 = 9 exactly... but the last tile hit only has 6 to go
    // through, so the second-to-last leaves 3 standing.
    const fifth = playRounds(state, [TILE_LEFT_FLIPS, TILE_RIGHT_FLIPS]);
    expect(fifth.state.destroyed.humans).toHaveLength(9);
    expect(fifth.nightWinner).toBe('demons');

    // Nothing is ever destroyed twice, and the list can't outgrow the
    // nine targets that exist.
    expect(new Set(fifth.state.destroyed.humans).size).toBe(TARGETS_PER_SIDE);
  });

  it('asks for one beat per mark, so a multi-damage round gets a longer pause', () => {
    let state = trifectaEngine.initNight(config, noShuffle);

    // A single-symbol cell: one mark, the ordinary beat.
    expect(playRound(state, TRIKING_SINGLE_FLIPS).pauseScale).toBe(1);
    // A two-symbol cell: two marks, so twice the window.
    expect(playRound(state, TRIKING_DOUBLE_FLIPS).pauseScale).toBe(2);

    // The unlit tile deals nothing, but still wants its own quiet beat
    // rather than being rushed past.
    expect(playRound(state, TILE_LEFT_FLIPS).pauseScale).toBe(1);

    // ...and once every element is lit, the tile's three marks want three.
    state = trifectaEngine.startNextRound(playRound(state, AXE_FLIPS).state);
    state = trifectaEngine.startNextRound(playRound(state, FLYER_SPITTER_FLIPS).state);
    expect(playRound(state, TILE_LEFT_FLIPS).pauseScale).toBe(3);
  });

  it('records exactly which targets the closed round took, in draw order', () => {
    let state = trifectaEngine.initNight(config, noShuffle);

    // Demon targets are grouped 0-2 bigflyer, 3-5 axe, 6-8 spitter. This
    // hit is the TriKing beating pair 0, whose losing half is an Axe --
    // so it's Axe demons that come off the board, not simply the first
    // two in line (see 'takes the element it was scored against' below).
    const double = playRound(state, TRIKING_DOUBLE_FLIPS);
    expect(double.state.lastRound).toEqual({ side: 'demons', targets: [3, 4] });

    // The next round's own marks replace it rather than accumulating --
    // this is "what just happened", not a running log.
    state = trifectaEngine.startNextRound(double.state);
    expect(state.lastRound).toBeNull();
    const single = playRound(state, TRIKING_SINGLE_FLIPS);
    expect(single.state.lastRound).toEqual({ side: 'demons', targets: [0] });

    // A round that dealt no damage says so honestly rather than leaving
    // the previous round's marks looking fresh.
    const whiff = playRound(trifectaEngine.startNextRound(single.state), TILE_LEFT_FLIPS);
    expect(whiff.state.lastRound).toEqual({ side: 'humans', targets: [] });
  });

  it('takes the element it was scored against, not just the next in line', () => {
    const state = trifectaEngine.initNight(config, noShuffle);

    // Pair 6's losing half is a Big Flyer, so the TriKing's hit there
    // takes a Big Flyer claw (0-2) even though the running order is
    // identical for both hits.
    const flyer = playRound(state, TRIKING_SINGLE_FLIPS);
    expect(flyer.state.lastRound!.targets).toEqual([0]);

    // Pair 0's losing half is an Axe, so the same-sized hit there reaches
    // past the untouched Big Flyers to take an Axe demon (3-5) instead.
    const axe = playRound(state, TRIKING_DOUBLE_FLIPS);
    expect(axe.state.lastRound!.targets).toEqual([3, 4]);
  });

  it('spends the rest of a hit on the running order once its preferred group is gone', () => {
    let state = trifectaEngine.initNight(config, noShuffle);

    // Clear two of the three Axes first, so the next Axe-flavored hit has
    // only one left to prefer.
    state = trifectaEngine.startNextRound(playRound(state, TRIKING_DOUBLE_FLIPS).state);
    expect(state.destroyed.demons).toEqual([3, 4]);

    // A two-damage Axe hit now: the last Axe, then whatever was next in
    // line rather than the hit refusing to spend its second point.
    const spill = playRound(state, TRIKING_DOUBLE_FLIPS);
    expect(spill.state.lastRound!.targets).toEqual([5, 0]);
  });

  it('shuffles within a tier but never lets a hit jump one', () => {
    // Reversing every group is a shuffle the assertions can actually
    // name: within-tier order flips, tier order must not.
    const reverseShuffle = (n: number) => Array.from({ length: n }, (_, i) => n - 1 - i);
    let state = trifectaEngine.initNight(config, reverseShuffle);

    // Humans are tiered 0-3 / 4-7 / 8 (the torso), so reversing inside
    // each tier gives this -- crucially with 8 still last, not first.
    expect(state.crossOrder.humans).toEqual([3, 2, 1, 0, 7, 6, 5, 4, 8]);

    // Eight single-damage hits from the demons clear both lower tiers in
    // that shuffled order, and never touch the torso.
    for (let i = 0; i < 8; i++) {
      state = trifectaEngine.startNextRound(playRound(state, AXE_FLIPS).state);
    }
    expect(state.destroyed.humans).toEqual([3, 2, 1, 0, 7, 6, 5, 4]);
    expect(state.destroyed.humans).not.toContain(8);
  });

  it('keeps the closed round visible until startNextRound() resets it', () => {
    const state = trifectaEngine.initNight(config, noShuffle);
    const outcome = playRound(state, AXE_FLIPS);
    expect(outcome.state.currentRound.flips).toHaveLength(4);

    const reset = trifectaEngine.startNextRound(outcome.state);
    expect(reset.currentRound.flips).toHaveLength(0);
    expect(reset.currentRound.roundIndex).toBe(outcome.state.currentRound.roundIndex + 1);
    // Cumulative damage and activations both survive the reset.
    expect(reset.destroyed.humans).toHaveLength(1);
    expect(reset.activated).toEqual(['axe']);
  });
});
