import { describe, expect, it } from 'vitest';
import type { CoinFace, TeamworkNightState, TeamworkSheetConfig } from '@total-tossup-live/shared';
import { teamworkEngine } from './teamwork';
import { PORTAL_PRESET } from '../presets';

// demons.action=bat+chain (target 5, no defense), humans.action=book
// (target 6), humans.defense=ladder (target 5) -- see presets.ts's
// portalSheet(). CloudFight's own test file already exercises a
// multi-icon track fed by two different icons; this file confirms
// Portal's own PORTAL_ARRANGEMENT wiring resolves correctly with that
// same split now living on demons' side instead of humans', plus one
// push-back check mirroring Barricade's/Inferno's/RiverShark's own.
const config = PORTAL_PRESET.sheets[0].config as TeamworkSheetConfig;

// Flip sequences worked out against PORTAL_ARRANGEMENT: all-tails lands
// on pair 0 (OOO), whose O side is book; the same pair's X side (final
// flip heads) is chain. Pair 2 (OXO)'s O side is bat. Pair 4 (XOO)'s X
// side is ladder.
const BOOK_FLIPS: CoinFace[] = ['tails', 'tails', 'tails', 'tails'];
const CHAIN_FLIPS: CoinFace[] = ['tails', 'tails', 'tails', 'heads'];
const BAT_FLIPS: CoinFace[] = ['tails', 'heads', 'tails', 'tails'];
const LADDER_FLIPS: CoinFace[] = ['heads', 'tails', 'tails', 'heads'];

function playRound(state: TeamworkNightState, faces: CoinFace[]) {
  let current = state;
  let last: ReturnType<typeof teamworkEngine.applyFlip> | undefined;
  for (const face of faces) {
    last = teamworkEngine.applyFlip(current, config, face);
    current = last.state;
    if (last.roundClosed) break;
  }
  return last!;
}

describe('teamworkEngine with Portal config (multi-icon demons.action)', () => {
  it('chain and bat both add to the same demons.action track', () => {
    let state = teamworkEngine.initNight(config);

    const chainOutcome = playRound(state, CHAIN_FLIPS);
    expect(chainOutcome.roundWinner).toBe('demons');
    state = teamworkEngine.startNextRound(chainOutcome.state);
    expect(state.demons.action).toEqual(['chain']);

    const batOutcome = playRound(state, BAT_FLIPS);
    expect(batOutcome.roundWinner).toBe('demons');
    state = teamworkEngine.startNextRound(batOutcome.state);

    // One combined track, both icons present in order -- this is the
    // "handoff" data the dual-lane renderer reads.
    expect(state.demons.action).toEqual(['chain', 'bat']);
  });

  it('a book result adds to humans.action and favors humans', () => {
    const state = teamworkEngine.initNight(config);
    const outcome = playRound(state, BOOK_FLIPS);

    expect(outcome.roundWinner).toBe('humans');
    expect(outcome.state.humans.action).toEqual(['book']);
  });

  it('a ladder result adds to humans.defense and favors humans', () => {
    const state = teamworkEngine.initNight(config);
    const outcome = playRound(state, LADDER_FLIPS);

    expect(outcome.roundWinner).toBe('humans');
    expect(outcome.state.humans.defense).toEqual(['ladder']);
  });

  it("a ladder hit pushes bat+chain's combined target out by one, same as Barricade's planks/knife", () => {
    let state = teamworkEngine.initNight(config);

    const defenseOutcome = playRound(state, LADDER_FLIPS);
    expect(defenseOutcome.nightWinner).toBeNull();
    state = teamworkEngine.startNextRound(defenseOutcome.state);

    const alternating = [CHAIN_FLIPS, BAT_FLIPS];
    for (let round = 0; round < config.demons.action.target; round++) {
      const outcome = playRound(state, alternating[round % 2]);
      expect(outcome.nightWinner).toBeNull(); // still short of target + 1
      state = teamworkEngine.startNextRound(outcome.state);
    }
    expect(state.demons.action).toHaveLength(config.demons.action.target);

    const finalOutcome = playRound(state, alternating[config.demons.action.target % 2]);
    expect(finalOutcome.nightWinner).toBe('demons');
    expect(finalOutcome.state.demons.action).toHaveLength(config.demons.action.target + 1);
  });
});
