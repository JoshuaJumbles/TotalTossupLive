import { describe, expect, it } from 'vitest';
import type { CoinFace, RoyaltyStrength, RpfNightState, RpfSheetConfig, Side } from '@total-tossup-live/shared';
import { rockPaperFlipperEngine as engine } from './rockPaperFlipper';
import { RPF_PRESET } from '../presets';

const T = 'tails' as CoinFace;
const H = 'heads' as CoinFace;

/** Two flips address a fighter, most significant first: OO is index 0 at
 * the bottom of the arc, XX is index 3 at the top. */
const PICK = { 0: [T, T], 1: [T, H], 2: [H, T], 3: [H, H] } as const;

const noShuffle = (n: number) => Array.from({ length: n }, (_, i) => i);

/** A deliberately plain lineup -- rock, paper, scissors, royalty at
 * indices 0-3 on BOTH sides -- so every assertion below can name an index
 * and have it mean an obvious thing. The real Sheets rotate these; that
 * rotation is covered separately against RPF_PRESET. */
function testConfig(over: Partial<RpfSheetConfig> = {}): RpfSheetConfig {
  const court = [
    { name: 'Rock', type: 'rock' as const, art: 'rock' },
    { name: 'Paper', type: 'paper' as const, art: 'paper' },
    { name: 'Scissors', type: 'scissors' as const, art: 'scissors' },
    { name: 'Royal', type: 'royalty' as const, art: 'royal' },
  ];
  return {
    familyId: 'rpf',
    leftSide: 'humans',
    lineup: { humans: [...court], demons: [...court] },
    rpsHealth: 1,
    royaltyHealth: 3,
    royaltyStrength: 'scrappy',
    ...over,
  };
}

/** Feeds a round's flips in and returns the final outcome. */
function playRound(state: RpfNightState, config: RpfSheetConfig, faces: CoinFace[]) {
  let current = state;
  let last: ReturnType<typeof engine.applyFlip> | undefined;
  for (const face of faces) {
    last = engine.applyFlip(current, config, face);
    current = last.state;
    if (last.roundClosed) break;
  }
  return last!;
}

/** The four pick flips for a given matchup, left fighter first. */
function matchup(left: 0 | 1 | 2 | 3, right: 0 | 1 | 2 | 3): CoinFace[] {
  return [...PICK[left], ...PICK[right]];
}

describe('Rock Paper Flipper: picking the fighters', () => {
  it('addresses the bottom of the arc with OO and the top with XX', () => {
    const config = testConfig();
    // Left index 3 (royalty) against right index 0 (rock), scrappy, so it
    // ties and needs a fifth flip -- which only happens if both picks
    // landed where we think they did.
    const outcome = playRound(engine.initNight(config, noShuffle), config, matchup(3, 0));
    expect(outcome.roundClosed).toBe(false);
    expect(outcome.state.currentRound.flips).toHaveLength(4);
  });

  it('reads the first two flips as the left side and the next two as the right', () => {
    const config = testConfig({ leftSide: 'humans' });
    const outcome = playRound(engine.initNight(config, noShuffle), config, matchup(0, 2));
    expect(outcome.state.lastRound!.picked.humans).toBe(0);
    expect(outcome.state.lastRound!.picked.demons).toBe(2);
  });

  it('follows config.leftSide when the teams swap sides of the ring', () => {
    const config = testConfig({ leftSide: 'demons' });
    const outcome = playRound(engine.initNight(config, noShuffle), config, matchup(0, 2));
    // Same flips, opposite reading: the first pair now addresses demons.
    expect(outcome.state.lastRound!.picked.demons).toBe(0);
    expect(outcome.state.lastRound!.picked.humans).toBe(2);
  });
});

describe('Rock Paper Flipper: Rock, Paper and Scissors', () => {
  const cases: Array<[string, 0 | 1 | 2, 0 | 1 | 2, Side]> = [
    ['rock beats scissors', 0, 2, 'humans'],
    ['scissors beats paper', 2, 1, 'humans'],
    ['paper beats rock', 1, 0, 'humans'],
    ['scissors loses to rock', 2, 0, 'demons'],
    ['paper loses to scissors', 1, 2, 'demons'],
    ['rock loses to paper', 0, 1, 'demons'],
  ];

  for (const [label, left, right, winner] of cases) {
    it(label, () => {
      const config = testConfig();
      const outcome = playRound(engine.initNight(config, noShuffle), config, matchup(left, right));
      expect(outcome.roundClosed).toBe(true);
      expect(outcome.roundWinner).toBe(winner);
      expect(outcome.state.lastRound!.tiebreak).toBe(false);
      const loser: Side = winner === 'humans' ? 'demons' : 'humans';
      const loserIndex = winner === 'humans' ? right : left;
      expect(outcome.state.damage[loser][loserIndex]).toBe(1);
    });
  }

  it('sends a mirror matchup to a fifth, tie-breaking flip', () => {
    const config = testConfig();
    const fourFlips = playRound(engine.initNight(config, noShuffle), config, matchup(0, 0));
    expect(fourFlips.roundClosed).toBe(false);

    // Tails gives it to the left of the ring, heads to the right.
    const toLeft = playRound(engine.initNight(config, noShuffle), config, [...matchup(0, 0), T]);
    expect(toLeft.roundWinner).toBe('humans');
    expect(toLeft.state.damage.demons[0]).toBe(1);
    expect(toLeft.state.lastRound!.tiebreak).toBe(true);

    const toRight = playRound(engine.initNight(config, noShuffle), config, [...matchup(0, 0), H]);
    expect(toRight.roundWinner).toBe('demons');
    expect(toRight.state.damage.humans[0]).toBe(1);
  });
});

describe('Rock Paper Flipper: Royalty strength', () => {
  const expected: Array<[RoyaltyStrength, Side | 'tie']> = [
    ['powerful', 'humans'],
    ['vulnerable', 'demons'],
    ['scrappy', 'tie'],
  ];

  for (const [royaltyStrength, result] of expected) {
    it(`${royaltyStrength}: royalty against rock ${result === 'tie' ? 'ties' : `is won by ${result}`}`, () => {
      const config = testConfig({ royaltyStrength });
      const outcome = playRound(engine.initNight(config, noShuffle), config, matchup(3, 0));
      if (result === 'tie') {
        expect(outcome.roundClosed).toBe(false);
      } else {
        expect(outcome.roundClosed).toBe(true);
        expect(outcome.roundWinner).toBe(result);
      }
    });
  }

  it('ties royalty against royalty however strength is set', () => {
    for (const royaltyStrength of ['powerful', 'vulnerable', 'scrappy'] as RoyaltyStrength[]) {
      const config = testConfig({ royaltyStrength });
      const outcome = playRound(engine.initNight(config, noShuffle), config, matchup(3, 3));
      expect(outcome.roundClosed).toBe(false);
    }
  });
});

describe('Rock Paper Flipper: the weak spot', () => {
  /** Knocks out one side's rock (index 0) by winning a round against it. */
  function withRockDown(config: RpfSheetConfig, side: Side) {
    let state = engine.initNight(config, noShuffle);
    // Paper beats rock: pick the attacker's paper against that side's rock.
    const faces = side === 'demons' ? matchup(1, 0) : matchup(0, 1);
    const outcome = playRound(state, config, faces);
    state = engine.startNextRound(outcome.state);
    expect(state.damage[side][0]).toBe(config.rpsHealth);
    return state;
  }

  it('carries the blow through a downed fighter to that side\'s Royalty', () => {
    const config = testConfig();
    const state = withRockDown(config, 'demons');

    // Demons' rock is down, so picking it leaves a hole: humans' rock
    // would normally tie against it, but a downed fighter loses to
    // everything.
    const outcome = playRound(state, config, matchup(0, 0));
    expect(outcome.roundClosed).toBe(true);
    expect(outcome.roundWinner).toBe('humans');
    expect(outcome.state.lastRound!.weakSpot).toBe(true);
    // Damage lands on the royalty (index 3), not the fighter picked.
    expect(outcome.state.damage.demons[3]).toBe(1);
    expect(outcome.state.lastRound!.defenderIndex).toBe(3);
    // The arrow runs from the attacker straight to the Royalty.
    expect(outcome.state.lastRound!.picked.demons).toBe(0);
  });

  it('beats even Royalty, since a downed fighter is the lowest power there is', () => {
    const config = testConfig({ royaltyStrength: 'powerful' });
    const state = withRockDown(config, 'demons');
    // Powerful royalty would normally beat anything, but the demons'
    // pick is down, so they lose regardless.
    const outcome = playRound(state, config, matchup(3, 0));
    expect(outcome.roundWinner).toBe('humans');
    expect(outcome.state.lastRound!.weakSpot).toBe(true);
  });

  it('ties when BOTH sides pick a downed fighter, and then breaks it', () => {
    const config = testConfig();
    let state = engine.initNight(config, noShuffle);
    // Knock out demons' rock, then humans' rock.
    state = engine.startNextRound(playRound(state, config, matchup(1, 0)).state);
    state = engine.startNextRound(playRound(state, config, matchup(0, 1)).state);
    expect(state.damage.demons[0]).toBe(1);
    expect(state.damage.humans[0]).toBe(1);

    const fourFlips = playRound(state, config, matchup(0, 0));
    expect(fourFlips.roundClosed).toBe(false);

    const broken = playRound(state, config, [...matchup(0, 0), T]);
    expect(broken.roundWinner).toBe('humans');
    expect(broken.state.lastRound!.weakSpot).toBe(true);
    expect(broken.state.damage.demons[3]).toBe(1);
  });
});

describe('Rock Paper Flipper: the Night', () => {
  it('lands exactly one damage every round, never none', () => {
    const config = testConfig();
    let state = engine.initNight(config, noShuffle);
    let total = 0;
    // A spread of matchups including mirrors, royalty and a tiebreak.
    const rounds: CoinFace[][] = [
      matchup(0, 2),
      matchup(1, 0),
      [...matchup(2, 2), H],
      [...matchup(3, 1), T],
      matchup(2, 1),
    ];
    for (const faces of rounds) {
      const outcome = playRound(state, config, faces);
      expect(outcome.roundClosed).toBe(true);
      const before = total;
      total =
        outcome.state.damage.humans.reduce((a, b) => a + b, 0) +
        outcome.state.damage.demons.reduce((a, b) => a + b, 0);
      expect(total).toBe(before + 1);
      if (outcome.nightWinner) break;
      state = engine.startNextRound(outcome.state);
    }
  });

  it('ends the Night when a Royalty\'s last health is marked off', () => {
    const config = testConfig({ royaltyHealth: 3 });
    let state = engine.initNight(config, noShuffle);
    // Knock out the demons' rock, then keep hitting the hole it leaves.
    state = engine.startNextRound(playRound(state, config, matchup(1, 0)).state);

    let outcome: ReturnType<typeof engine.applyFlip> | undefined;
    for (let i = 0; i < 3; i += 1) {
      outcome = playRound(state, config, matchup(0, 0));
      expect(outcome.state.damage.demons[3]).toBe(i + 1);
      if (i < 2) {
        expect(outcome.nightWinner).toBeNull();
        state = engine.startNextRound(outcome.state);
      }
    }
    expect(outcome!.nightWinner).toBe('humans');
  });

  it('keeps every bout in history, which is the map of the action', () => {
    const config = testConfig();
    let state = engine.initNight(config, noShuffle);
    for (const faces of [matchup(0, 2), matchup(1, 0), matchup(2, 1)]) {
      state = engine.startNextRound(playRound(state, config, faces).state);
    }
    expect(state.history).toHaveLength(3);
    expect(state.history[0].picked).toEqual({ humans: 0, demons: 2 });
    expect(state.history.every((b) => b.attacker === 'humans')).toBe(true);
    // startNextRound clears the pause's own bout but never the history.
    expect(state.lastRound).toBeNull();
  });
});

describe('Rock Paper Flipper: the shipped Sheets', () => {
  it('fields exactly one of each type per side on every Sheet', () => {
    for (const sheet of RPF_PRESET.sheets) {
      const config = sheet.config as RpfSheetConfig;
      for (const side of ['humans', 'demons'] as Side[]) {
        const types = config.lineup[side].map((f) => f.type).sort();
        expect(types, `${sheet.id} ${side}`).toEqual(['paper', 'rock', 'royalty', 'scissors']);
      }
    }
  });

  it('rotates the lineups between Sheets rather than repeating one order', () => {
    const orders = RPF_PRESET.sheets.map((sheet) =>
      (sheet.config as RpfSheetConfig).lineup.humans.map((f) => f.name).join(),
    );
    expect(new Set(orders).size).toBeGreaterThan(1);
  });

  it('plays a full Night of every Sheet to a winner without stalling', () => {
    // Guards the one way this Family could hang: a round that resolves to
    // no damage would loop forever, since nothing else ends a Night.
    for (const sheet of RPF_PRESET.sheets) {
      const config = sheet.config as RpfSheetConfig;
      let state = engine.initNight(config, noShuffle);
      let winner: Side | null = null;
      let rounds = 0;
      // Deterministic pseudo-random faces, so a failure is reproducible.
      let seed = 7;
      const nextFace = (): CoinFace => {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        return seed % 2 === 0 ? 'heads' : 'tails';
      };
      while (!winner && rounds < 100) {
        let outcome: ReturnType<typeof engine.applyFlip>;
        do {
          outcome = engine.applyFlip(state, config, nextFace());
          state = outcome.state;
        } while (!outcome.roundClosed);
        winner = outcome.nightWinner;
        if (!winner) state = engine.startNextRound(state);
        rounds += 1;
      }
      expect(winner, `${sheet.id} never reached a winner`).not.toBeNull();
      // Both health settings should finish well inside the total health
      // on the board, which is 2 * (3 * rpsHealth + royaltyHealth).
      expect(rounds).toBeLessThanOrEqual(2 * (3 * config.rpsHealth + config.royaltyHealth));
    }
  });
});
