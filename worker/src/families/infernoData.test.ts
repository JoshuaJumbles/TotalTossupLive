import { describe, expect, it } from 'vitest';
import type { CoinFace, TeamworkNightState, TeamworkSheetConfig } from '@total-tossup-live/shared';
import { teamworkEngine } from './teamwork';
import { INFERNO_PRESET } from '../presets';

// humans.action=water (target 6), humans.defense=shield (target 5),
// demons.action=fire (target 5, no defense) -- see presets.ts's
// infernoSheet(). The generic win math itself is already exercised by
// teamwork.test.ts; this file exists to confirm Inferno's own
// INFERNO_ARRANGEMENT wiring resolves to the right icon/track for a
// real grid cell -- a clean reskin of Barricade's shape, so no new
// mechanic to test here.
const config = INFERNO_PRESET.sheets[0].config as TeamworkSheetConfig;

// Flip sequences worked out against INFERNO_ARRANGEMENT: all-tails lands
// on pair 0 (OOO), whose O side is water; the same pair's X side (final
// flip heads) is fire. Pair 2 (OXO)'s X side is shield.
const WATER_FLIPS: CoinFace[] = ['tails', 'tails', 'tails', 'tails'];
const FIRE_FLIPS: CoinFace[] = ['tails', 'tails', 'tails', 'heads'];
const SHIELD_FLIPS: CoinFace[] = ['tails', 'heads', 'tails', 'heads'];

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

describe('teamworkEngine with Inferno config', () => {
  it('a water result adds to humans.action and favors humans', () => {
    const state = teamworkEngine.initNight(config);
    const outcome = playRound(state, WATER_FLIPS);

    expect(outcome.roundWinner).toBe('humans');
    expect(outcome.state.humans.action).toEqual(['water']);
  });

  it('a fire result adds to demons.action and favors demons', () => {
    const state = teamworkEngine.initNight(config);
    const outcome = playRound(state, FIRE_FLIPS);

    expect(outcome.roundWinner).toBe('demons');
    expect(outcome.state.demons.action).toEqual(['fire']);
  });

  it('a shield result adds to humans.defense and favors humans', () => {
    const state = teamworkEngine.initNight(config);
    const outcome = playRound(state, SHIELD_FLIPS);

    expect(outcome.roundWinner).toBe('humans');
    expect(outcome.state.humans.defense).toEqual(['shield']);
  });

  it('a shield hit pushes fire\'s own target out by one, same as Barricade\'s planks/knife', () => {
    let state = teamworkEngine.initNight(config);

    const defenseOutcome = playRound(state, SHIELD_FLIPS);
    expect(defenseOutcome.nightWinner).toBeNull();
    state = teamworkEngine.startNextRound(defenseOutcome.state);

    for (let round = 0; round < config.demons.action.target; round++) {
      const outcome = playRound(state, FIRE_FLIPS);
      expect(outcome.nightWinner).toBeNull(); // still short of target + 1
      state = teamworkEngine.startNextRound(outcome.state);
    }
    expect(state.demons.action).toHaveLength(config.demons.action.target);

    const finalOutcome = playRound(state, FIRE_FLIPS);
    expect(finalOutcome.nightWinner).toBe('demons');
    expect(finalOutcome.state.demons.action).toHaveLength(config.demons.action.target + 1);
  });
});
