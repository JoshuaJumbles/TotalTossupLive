import type { CoinFace, Side, TeamworkNightState, TeamworkSheetConfig, TeamworkTrackConfig } from '@total-tossup-live/shared';
import { resolveGridCell } from '@total-tossup-live/shared';
import type { FamilyEngine } from './types';

/** Teamwork's round is always exactly 4 flips -- not a tunable config knob
 * like bestof's roundSize, since the grid math itself needs exactly 4 bits
 * (2 for row, 2 for column) to address one of the 16 cells. */
const ROUND_SIZE = 4;

function flipWinnerForFace(face: CoinFace): Side {
  // Not semantically meaningful for Teamwork -- a single flip is just one
  // bit of the eventual 4-flip cell address, not its own win/loss. Kept
  // only because FlipOutcome requires a Side per flip; same placeholder
  // convention bestof.ts uses for its own (real) per-flip winner.
  return face === 'heads' ? 'humans' : 'demons';
}

function otherSide(side: Side): Side {
  return side === 'humans' ? 'demons' : 'humans';
}

/** Which side+track a resolved icon feeds -- every icon belongs to
 * exactly one track on exactly one side, checked by membership against
 * the config's own icons arrays (the authoritative source of that
 * mapping) rather than a separate lookup table. */
function trackFor(config: TeamworkSheetConfig, icon: string): { side: Side; track: 'action' | 'defense' } {
  for (const side of ['humans', 'demons'] as const) {
    const sideConfig = config[side];
    if (sideConfig.action.icons.includes(icon)) return { side, track: 'action' };
    if (sideConfig.defense?.icons.includes(icon)) return { side, track: 'defense' };
  }
  throw new Error(`icon "${icon}" is not assigned to any track in this Sheet's config`);
}

/** How much a defense track's marks-so-far push the *other* side's action
 * target out, right now -- floor(marks * pushValue), same rounding-down
 * rule for a half-built final point that defenseWinMarks() below uses.
 * `undefined` (a side with no defense track at all) never pushes. */
function pushback(track: TeamworkTrackConfig<string> | undefined, marks: string[]): number {
  if (!track) return 0;
  return Math.floor(marks.length * (track.pushValue ?? 1));
}

/** How many raw marks a defense track needs to win the Night *by itself*.
 * Normally exactly its own target -- pushValue defaults to 1, so every
 * mark is a full point and reaching the target IS winning. A fractional
 * pushValue (Rooftop's own defense tracks, still ahead -- see
 * TeamworkTrackConfig's own doc comment) needs one mark *more* than the
 * count that exactly reaches the target's worth of value, since a
 * half-built final point doesn't count as won -- Josh's own framing was
 * "wins when it exceeds the target," which is exactly this. */
function defenseWinMarks(track: TeamworkTrackConfig<string>): number {
  const pushValue = track.pushValue ?? 1;
  if (pushValue >= 1) return track.target;
  return Math.floor(track.target / pushValue) + 1;
}

/**
 * The Teamwork Family -- one engine for every Sheet sharing its
 * per-side "action + optional defense" shape (see shared/family.ts's
 * TeamworkSheetConfig for the full arithmetic writeup; this is purely
 * that arithmetic in code, with zero Sheet-specific values). Every round
 * is 4 flips resolving to one grid cell (see shared/symbolGrid.ts's
 * resolveGridCell), and `config.arrangement` says which icon that cell
 * holds; `trackFor` says which side's which track that icon feeds.
 *
 * Win check, run after every track update, once per side: a side wins by
 * fully building its own `defense` track (see defenseWinMarks -- ends
 * the Night immediately, since that's what's been pushing the opponent's
 * target out in the first place), or by reaching its own `action`
 * target plus however much pushback the *other* side's `defense` marks
 * are currently worth. Since a round can only ever add one mark to one
 * track, at most one side's check can newly become true per round -- no
 * tie-breaking needed between them.
 */
export const teamworkEngine: FamilyEngine<TeamworkNightState, TeamworkSheetConfig> = {
  initNight(_config) {
    return {
      familyId: 'teamwork',
      currentRound: { roundIndex: 0, flips: [] },
      humans: { action: [], defense: [] },
      demons: { action: [], defense: [] },
    };
  },

  applyFlip(state, config, face) {
    const winner = flipWinnerForFace(face);
    const sequenceIndex = state.currentRound.flips.length;
    const flips = [...state.currentRound.flips, { sequenceIndex, face, winner }];

    const roundClosed = flips.length >= ROUND_SIZE;

    if (!roundClosed) {
      return {
        state: { ...state, currentRound: { ...state.currentRound, flips } },
        flipWinner: winner,
        roundClosed: false,
        roundWinner: null,
        nightWinner: null,
      };
    }

    // All 4 faces are resolved by construction (a flip only reaches here
    // once its face is revealed), so this cast is safe.
    const faces = flips.map((f) => f.face) as [CoinFace, CoinFace, CoinFace, CoinFace];
    const { pairIndex, side: cellSide } = resolveGridCell(faces);
    const icon = config.arrangement[pairIndex][cellSide];
    const { side: markedSide, track: markedTrack } = trackFor(config, icon);

    const humans = {
      action: markedSide === 'humans' && markedTrack === 'action' ? [...state.humans.action, icon] : state.humans.action,
      defense: markedSide === 'humans' && markedTrack === 'defense' ? [...state.humans.defense, icon] : state.humans.defense,
    };
    const demons = {
      action: markedSide === 'demons' && markedTrack === 'action' ? [...state.demons.action, icon] : state.demons.action,
      defense: markedSide === 'demons' && markedTrack === 'defense' ? [...state.demons.defense, icon] : state.demons.defense,
    };
    const sides = { humans, demons };

    // Whichever side's track (action or defense) actually claimed this
    // round's mark is the one credited with the round win.
    const roundWinner: Side = markedSide;

    let nightWinner: Side | null = null;
    for (const side of ['humans', 'demons'] as const) {
      const sideConfig = config[side];
      const sideState = sides[side];
      const opponentConfig = config[otherSide(side)];
      const opponentState = sides[otherSide(side)];

      if (sideConfig.defense && sideState.defense.length >= defenseWinMarks(sideConfig.defense)) {
        nightWinner = side;
        break;
      }
      const effectiveTarget = sideConfig.action.target + pushback(opponentConfig.defense, opponentState.defense);
      if (sideState.action.length >= effectiveTarget) {
        nightWinner = side;
        break;
      }
    }

    return {
      state: {
        ...state,
        humans,
        demons,
        // currentRound is kept (not reset) so the round_resolved pause
        // can display the round that just closed; startNextRound() resets
        // it, same convention bestof.ts uses.
        currentRound: { ...state.currentRound, flips },
      },
      flipWinner: winner,
      roundClosed: true,
      roundWinner,
      nightWinner,
    };
  },

  startNextRound(state) {
    return { ...state, currentRound: { roundIndex: state.currentRound.roundIndex + 1, flips: [] } };
  },
};
