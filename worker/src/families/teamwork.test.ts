import { describe, expect, it } from 'vitest';
import type { CoinFace, TeamworkNightState, TeamworkSheetConfig } from '@total-tossup-live/shared';
import { teamworkEngine } from './teamwork';
import { TEAMWORK_PRESET } from '../presets';

const config = TEAMWORK_PRESET.sheets[0].config as TeamworkSheetConfig; // targetMedkit: 6, targetBarricade: 5, baseTargetKnife: 5

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

  it('resolves a full round to the grid cell icon and increments the matching count', () => {
    const state = teamworkEngine.initNight(config);
    const outcome = playRound(state, MEDKIT_FLIPS);

    expect(outcome.roundClosed).toBe(true);
    expect(outcome.roundWinner).toBe('humans');
    expect(outcome.state.medkitCount).toBe(1);
    expect(outcome.state.knifeCount).toBe(0);
    expect(outcome.state.barricadeCount).toBe(0);
    expect(outcome.state.currentRound.flips).toHaveLength(4);
  });

  it('a planks result increments barricadeCount and favors humans', () => {
    const state = teamworkEngine.initNight(config);
    const outcome = playRound(state, PLANKS_FLIPS);

    expect(outcome.roundWinner).toBe('humans');
    expect(outcome.state.barricadeCount).toBe(1);
  });

  it('a knife result increments knifeCount and favors demons', () => {
    const state = teamworkEngine.initNight(config);
    const outcome = playRound(state, KNIFE_FLIPS);

    expect(outcome.roundWinner).toBe('demons');
    expect(outcome.state.knifeCount).toBe(1);
  });

  it('keeps the closed round visible until startNextRound() resets it', () => {
    const state = teamworkEngine.initNight(config);
    const outcome = playRound(state, KNIFE_FLIPS);
    expect(outcome.state.currentRound.flips).toHaveLength(4);

    const reset = teamworkEngine.startNextRound(outcome.state);
    expect(reset.currentRound.flips).toHaveLength(0);
    expect(reset.currentRound.roundIndex).toBe(outcome.state.currentRound.roundIndex + 1);
    // Cumulative counts survive the reset.
    expect(reset.knifeCount).toBe(1);
  });

  it('declares humans the winner once medkitCount reaches targetMedkit', () => {
    let state = teamworkEngine.initNight(config);
    let nightWinner: string | null = null;

    for (let round = 0; round < config.targetMedkit; round++) {
      const outcome = playRound(state, MEDKIT_FLIPS);
      const isLastRound = round === config.targetMedkit - 1;
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

  it('declares humans the winner once barricadeCount reaches targetBarricade', () => {
    let state = teamworkEngine.initNight(config);
    let nightWinner: string | null = null;

    for (let round = 0; round < config.targetBarricade; round++) {
      const outcome = playRound(state, PLANKS_FLIPS);
      const isLastRound = round === config.targetBarricade - 1;
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

  it('declares demons the winner at baseTargetKnife when no barricade has landed', () => {
    let state = teamworkEngine.initNight(config);
    let nightWinner: string | null = null;

    for (let round = 0; round < config.baseTargetKnife; round++) {
      const outcome = playRound(state, KNIFE_FLIPS);
      const isLastRound = round === config.baseTargetKnife - 1;
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

  it('a barricade hit pushes the demons own knife target out by one -- the "defended" formula', () => {
    let state = teamworkEngine.initNight(config);

    // One barricade hit first: still no winner, target should now sit at
    // baseTargetKnife + 1 rather than baseTargetKnife.
    const barricadeOutcome = playRound(state, PLANKS_FLIPS);
    expect(barricadeOutcome.nightWinner).toBeNull();
    state = teamworkEngine.startNextRound(barricadeOutcome.state);

    // Knife hits up to (but not including) the new, pushed-out target
    // must NOT win yet.
    for (let round = 0; round < config.baseTargetKnife; round++) {
      const outcome = playRound(state, KNIFE_FLIPS);
      expect(outcome.nightWinner).toBeNull(); // still short of baseTargetKnife + 1
      state = teamworkEngine.startNextRound(outcome.state);
    }
    expect(state.knifeCount).toBe(config.baseTargetKnife);

    // One more knife hit reaches baseTargetKnife + 1 -- demons win.
    const finalOutcome = playRound(state, KNIFE_FLIPS);
    expect(finalOutcome.nightWinner).toBe('demons');
    expect(finalOutcome.state.knifeCount).toBe(config.baseTargetKnife + 1);
  });

  it('maps heads to humans and tails to demons for the per-flip (not per-round) winner', () => {
    const state = teamworkEngine.initNight(config);
    expect(teamworkEngine.applyFlip(state, config, 'heads').flipWinner).toBe('humans');
    expect(teamworkEngine.applyFlip(state, config, 'tails').flipWinner).toBe('demons');
  });
});
