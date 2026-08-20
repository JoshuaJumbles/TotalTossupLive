import { describe, expect, it } from 'vitest';
import type { CoinFace, TeamworkNightState, TeamworkSheetConfig } from '@total-tossup-live/shared';
import { teamworkEngine } from './teamwork';
import { TEAMWORK_PRESET } from '../presets';

// humans.action=medkit (target 6), humans.defense=planks (target 5),
// demons.action=knife (target 5, no defense) -- see presets.ts's
// barricadeSheet(). teamworkEngine itself operates generically on plain
// string icons (matching how families/registry.ts's engineFor() dispatches
// it at runtime), so this stays untyped-to-BarricadeIcon here too, same as
// the engine's own signature.
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
    expect(outcome.state.humans.action).toEqual(['medkit']);
    expect(outcome.state.humans.defense).toHaveLength(0);
    expect(outcome.state.demons.action).toHaveLength(0);
    expect(outcome.state.currentRound.flips).toHaveLength(4);
  });

  it('a planks result adds to humans.defense and favors humans', () => {
    const state = teamworkEngine.initNight(config);
    const outcome = playRound(state, PLANKS_FLIPS);

    expect(outcome.roundWinner).toBe('humans');
    expect(outcome.state.humans.defense).toEqual(['planks']);
  });

  it('a knife result adds to demons.action and favors demons', () => {
    const state = teamworkEngine.initNight(config);
    const outcome = playRound(state, KNIFE_FLIPS);

    expect(outcome.roundWinner).toBe('demons');
    expect(outcome.state.demons.action).toEqual(['knife']);
  });

  it('keeps the closed round visible until startNextRound() resets it', () => {
    const state = teamworkEngine.initNight(config);
    const outcome = playRound(state, KNIFE_FLIPS);
    expect(outcome.state.currentRound.flips).toHaveLength(4);

    const reset = teamworkEngine.startNextRound(outcome.state);
    expect(reset.currentRound.flips).toHaveLength(0);
    expect(reset.currentRound.roundIndex).toBe(outcome.state.currentRound.roundIndex + 1);
    // Cumulative tracks survive the reset.
    expect(reset.demons.action).toHaveLength(1);
  });

  it("declares humans the winner once humans.action reaches its target", () => {
    let state = teamworkEngine.initNight(config);
    let nightWinner: string | null = null;

    for (let round = 0; round < config.humans.action.target; round++) {
      const outcome = playRound(state, MEDKIT_FLIPS);
      const isLastRound = round === config.humans.action.target - 1;
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

  it("declares humans the winner once humans.defense reaches its target", () => {
    let state = teamworkEngine.initNight(config);
    let nightWinner: string | null = null;
    const target = config.humans.defense!.target;

    for (let round = 0; round < target; round++) {
      const outcome = playRound(state, PLANKS_FLIPS);
      const isLastRound = round === target - 1;
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

  it("declares demons the winner at demons.action's target when no defense has landed", () => {
    let state = teamworkEngine.initNight(config);
    let nightWinner: string | null = null;

    for (let round = 0; round < config.demons.action.target; round++) {
      const outcome = playRound(state, KNIFE_FLIPS);
      const isLastRound = round === config.demons.action.target - 1;
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

  it('a humans.defense hit pushes demons.action\'s own target out by one -- the "defended" formula', () => {
    let state = teamworkEngine.initNight(config);

    // One defense hit first: still no winner, target should now sit at
    // demons.action.target + 1 rather than demons.action.target.
    const defenseOutcome = playRound(state, PLANKS_FLIPS);
    expect(defenseOutcome.nightWinner).toBeNull();
    state = teamworkEngine.startNextRound(defenseOutcome.state);

    // Demons' hits up to (but not including) the new, pushed-out target
    // must NOT win yet.
    for (let round = 0; round < config.demons.action.target; round++) {
      const outcome = playRound(state, KNIFE_FLIPS);
      expect(outcome.nightWinner).toBeNull(); // still short of target + 1
      state = teamworkEngine.startNextRound(outcome.state);
    }
    expect(state.demons.action).toHaveLength(config.demons.action.target);

    // One more demons hit reaches target + 1 -- demons win.
    const finalOutcome = playRound(state, KNIFE_FLIPS);
    expect(finalOutcome.nightWinner).toBe('demons');
    expect(finalOutcome.state.demons.action).toHaveLength(config.demons.action.target + 1);
  });

  it('maps heads to humans and tails to demons for the per-flip (not per-round) winner', () => {
    const state = teamworkEngine.initNight(config);
    expect(teamworkEngine.applyFlip(state, config, 'heads').flipWinner).toBe('humans');
    expect(teamworkEngine.applyFlip(state, config, 'tails').flipWinner).toBe('demons');
  });
});
