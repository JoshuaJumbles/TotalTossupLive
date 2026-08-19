import { describe, expect, it } from 'vitest';
import type { CoinFace, TeamworkNightState, TeamworkSheetConfig } from '@total-tossup-live/shared';
import { teamworkEngine } from './teamwork';
import { TEAMWORK_PRESET } from '../presets';

// attacker='demons' (knife, target 5), defenderAction=medkit (target 6),
// defenderDefense=planks (target 5) -- see presets.ts's barricadeSheet().
// teamworkEngine itself operates generically on plain string icons
// (matching how families/registry.ts's engineFor() dispatches it at
// runtime), so this stays untyped-to-BarricadeIcon here too, same as the
// engine's own signature.
const config = TEAMWORK_PRESET.sheets[0].config as TeamworkSheetConfig;

// Flip sequences that land on a known icon, worked out against
// BARRICADE_ARRANGEMENT: all-tails lands on pair 0 (OOO), whose O side is
// knife; the same pair's X side (final flip heads) is planks; pair 1
// (OOX)'s X side is medkit.
const KNIFE_FLIPS: CoinFace[] = ['tails', 'tails', 'tails', 'tails'];
const PLANKS_FLIPS: CoinFace[] = ['tails', 'tails', 'tails', 'heads'];
const MEDKIT_FLIPS: CoinFace[] = ['tails', 'tails', 'heads', 'heads'];

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

describe('teamworkEngine', () => {
  it('does not close a round before all 4 flips land', () => {
    const state = teamworkEngine.initNight(config);
    const outcome = playRound(state, ['tails', 'tails', 'tails']);

    expect(outcome.roundClosed).toBe(false);
    expect(outcome.roundWinner).toBeNull();
    expect(outcome.state.currentRound.flips).toHaveLength(3);
  });

  it('resolves a full round to the grid cell icon and adds it to the matching track', () => {
    const state = teamworkEngine.initNight(config);
    const outcome = playRound(state, MEDKIT_FLIPS);

    expect(outcome.roundClosed).toBe(true);
    expect(outcome.roundWinner).toBe('humans');
    expect(outcome.state.defenderAction).toEqual(['medkit']);
    expect(outcome.state.attackerAction).toHaveLength(0);
    expect(outcome.state.defenderDefense).toHaveLength(0);
    expect(outcome.state.currentRound.flips).toHaveLength(4);
  });

  it('a planks result adds to defenderDefense and favors humans', () => {
    const state = teamworkEngine.initNight(config);
    const outcome = playRound(state, PLANKS_FLIPS);

    expect(outcome.roundWinner).toBe('humans');
    expect(outcome.state.defenderDefense).toEqual(['planks']);
  });

  it('a knife result adds to attackerAction and favors demons', () => {
    const state = teamworkEngine.initNight(config);
    const outcome = playRound(state, KNIFE_FLIPS);

    expect(outcome.roundWinner).toBe('demons');
    expect(outcome.state.attackerAction).toEqual(['knife']);
  });

  it('keeps the closed round visible until startNextRound() resets it', () => {
    const state = teamworkEngine.initNight(config);
    const outcome = playRound(state, KNIFE_FLIPS);
    expect(outcome.state.currentRound.flips).toHaveLength(4);

    const reset = teamworkEngine.startNextRound(outcome.state);
    expect(reset.currentRound.flips).toHaveLength(0);
    expect(reset.currentRound.roundIndex).toBe(outcome.state.currentRound.roundIndex + 1);
    // Cumulative tracks survive the reset.
    expect(reset.attackerAction).toHaveLength(1);
  });

  it('declares humans the winner once defenderAction reaches its target', () => {
    let state = teamworkEngine.initNight(config);
    let nightWinner: string | null = null;

    for (let round = 0; round < config.defenderAction.target; round++) {
      const outcome = playRound(state, MEDKIT_FLIPS);
      const isLastRound = round === config.defenderAction.target - 1;
      if (isLastRound) {
        expect(outcome.nightWinner).toBe('humans');
        nightWinner = outcome.nightWinner;
      } else {
        expect(outcome.nightWinner).toBeNull();
        state = teamworkEngine.startNextRound(outcome.state);
      }
    }

    expect(nightWinner).toBe('humans');
  });

  it('declares humans the winner once defenderDefense reaches its target', () => {
    let state = teamworkEngine.initNight(config);
    let nightWinner: string | null = null;

    for (let round = 0; round < config.defenderDefense.target; round++) {
      const outcome = playRound(state, PLANKS_FLIPS);
      const isLastRound = round === config.defenderDefense.target - 1;
      if (isLastRound) {
        expect(outcome.nightWinner).toBe('humans');
        nightWinner = outcome.nightWinner;
      } else {
        expect(outcome.nightWinner).toBeNull();
        state = teamworkEngine.startNextRound(outcome.state);
      }
    }

    expect(nightWinner).toBe('humans');
  });

  it('declares demons the winner at attackerAction.target when no defense has landed', () => {
    let state = teamworkEngine.initNight(config);
    let nightWinner: string | null = null;

    for (let round = 0; round < config.attackerAction.target; round++) {
      const outcome = playRound(state, KNIFE_FLIPS);
      const isLastRound = round === config.attackerAction.target - 1;
      if (isLastRound) {
        expect(outcome.nightWinner).toBe('demons');
        nightWinner = outcome.nightWinner;
      } else {
        expect(outcome.nightWinner).toBeNull();
        state = teamworkEngine.startNextRound(outcome.state);
      }
    }

    expect(nightWinner).toBe('demons');
  });

  it('a defenderDefense hit pushes attackerAction\'s own target out by one -- the "defended" formula', () => {
    let state = teamworkEngine.initNight(config);

    // One defense hit first: still no winner, target should now sit at
    // attackerAction.target + 1 rather than attackerAction.target.
    const defenseOutcome = playRound(state, PLANKS_FLIPS);
    expect(defenseOutcome.nightWinner).toBeNull();
    state = teamworkEngine.startNextRound(defenseOutcome.state);

    // Attacker hits up to (but not including) the new, pushed-out target
    // must NOT win yet.
    for (let round = 0; round < config.attackerAction.target; round++) {
      const outcome = playRound(state, KNIFE_FLIPS);
      expect(outcome.nightWinner).toBeNull(); // still short of target + 1
      state = teamworkEngine.startNextRound(outcome.state);
    }
    expect(state.attackerAction).toHaveLength(config.attackerAction.target);

    // One more attacker hit reaches target + 1 -- demons win.
    const finalOutcome = playRound(state, KNIFE_FLIPS);
    expect(finalOutcome.nightWinner).toBe('demons');
    expect(finalOutcome.state.attackerAction).toHaveLength(config.attackerAction.target + 1);
  });

  it('maps heads to humans and tails to demons for the per-flip (not per-round) winner', () => {
    const state = teamworkEngine.initNight(config);
    expect(teamworkEngine.applyFlip(state, config, 'heads').flipWinner).toBe('humans');
    expect(teamworkEngine.applyFlip(state, config, 'tails').flipWinner).toBe('demons');
  });
});
