import { describe, expect, it } from 'vitest';
import type { CoinFace, TeamworkNightState, TeamworkSheetConfig } from '@total-tossup-live/shared';
import { teamworkEngine } from './teamwork';
import { RIVERSHARK_PRESET } from '../presets';

// humans.action=gun (target 6), humans.defense=oar (target 5),
// demons.action=shark (target 5, no defense) -- see presets.ts's
// riverSharkSheet(). The generic win math itself is already exercised
// by teamwork.test.ts; this file exists to confirm RiverShark's own
// RIVERSHARK_ARRANGEMENT wiring resolves to the right icon/track for a
// real grid cell -- another clean reskin of Barricade's shape, so no
// new mechanic to test here.
const config = RIVERSHARK_PRESET.sheets[0].config as TeamworkSheetConfig;

// Flip sequences worked out against RIVERSHARK_ARRANGEMENT: all-tails
// lands on pair 0 (OOO), whose O side is gun; the same pair's X side
// (final flip heads) is shark. Pair 1 (OOX)'s O side is oar.
const GUN_FLIPS: CoinFace[] = ['tails', 'tails', 'tails', 'tails'];
const SHARK_FLIPS: CoinFace[] = ['tails', 'tails', 'tails', 'heads'];
const OAR_FLIPS: CoinFace[] = ['tails', 'tails', 'heads', 'tails'];

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

describe('teamworkEngine with RiverShark config', () => {
  it('a gun result adds to humans.action and favors humans', () => {
    const state = teamworkEngine.initNight(config);
    const outcome = playRound(state, GUN_FLIPS);

    expect(outcome.roundWinner).toBe('humans');
    expect(outcome.state.humans.action).toEqual(['gun']);
  });

  it('a shark result adds to demons.action and favors demons', () => {
    const state = teamworkEngine.initNight(config);
    const outcome = playRound(state, SHARK_FLIPS);

    expect(outcome.roundWinner).toBe('demons');
    expect(outcome.state.demons.action).toEqual(['shark']);
  });

  it('an oar result adds to humans.defense and favors humans', () => {
    const state = teamworkEngine.initNight(config);
    const outcome = playRound(state, OAR_FLIPS);

    expect(outcome.roundWinner).toBe('humans');
    expect(outcome.state.humans.defense).toEqual(['oar']);
  });

  it("an oar hit pushes shark's own target out by one, same as Barricade's planks/knife", () => {
    let state = teamworkEngine.initNight(config);

    const defenseOutcome = playRound(state, OAR_FLIPS);
    expect(defenseOutcome.nightWinner).toBeNull();
    state = teamworkEngine.startNextRound(defenseOutcome.state);

    for (let round = 0; round < config.demons.action.target; round++) {
      const outcome = playRound(state, SHARK_FLIPS);
      expect(outcome.nightWinner).toBeNull(); // still short of target + 1
      state = teamworkEngine.startNextRound(outcome.state);
    }
    expect(state.demons.action).toHaveLength(config.demons.action.target);

    const finalOutcome = playRound(state, SHARK_FLIPS);
    expect(finalOutcome.nightWinner).toBe('demons');
    expect(finalOutcome.state.demons.action).toHaveLength(config.demons.action.target + 1);
  });
});
