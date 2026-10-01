import type { DemonKingIcon, Side, TrifectaCell, TrifectaTarget } from '@total-tossup-live/shared';

function symbols(...icons: DemonKingIcon[]): TrifectaCell<DemonKingIcon> {
  return { kind: 'symbols', symbols: icons };
}

const TILE: TrifectaCell<DemonKingIcon> = { kind: 'trifecta' };

/**
 * Demon King's grid: which cell sits on each of the 8 pairs' O side (left)
 * and X side (right), keyed by pair index (see shared/src/symbolGrid.ts's
 * resolveGridCell). Transcribed from Joshua's DemonKingGrid export.
 *
 * Fifth Sheet, and the skeleton holds again: each element in exactly 3 of
 * the 16 cells, three single-element cells plus three two-element cells
 * covering each distinct pairing once (bow+swords, bow+fork, fork+swords),
 * uniform side across 8 cells with 13 symbols. The tile is on the third
 * row, straddling the centre -- the same slot KingHuman uses.
 */
export const DEMONKING_ARRANGEMENT: Record<number, { o: TrifectaCell<DemonKingIcon>; x: TrifectaCell<DemonKingIcon> }> = {
  0: { o: symbols('fork'), x: symbols('demonface', 'demonface') }, // OOO
  1: { o: symbols('demonface'), x: symbols('fork', 'swords') }, // OOX
  2: { o: symbols('demonface', 'demonface'), x: TILE }, // OXO -- tile, left half
  3: { o: TILE, x: symbols('demonface', 'demonface') }, // OXX -- tile, right half
  4: { o: symbols('bow', 'fork'), x: symbols('demonface') }, // XOO
  5: { o: symbols('swords'), x: symbols('demonface', 'demonface') }, // XOX
  6: { o: symbols('bow'), x: symbols('demonface', 'demonface') }, // XXO
  7: { o: symbols('bow', 'swords'), x: symbols('demonface') }, // XXX
};

/**
 * Both sides' nine destroyable targets, index-aligned with the mark art in
 * web/src/lib/demonKingMarkPaths.ts.
 *
 * This is the first Sheet where BOTH sides are a few things with several
 * hit points rather than nine separate ones, and neither needed engine
 * support -- targets that happen to share a body is all it ever was.
 *
 * The humans are three fighters at three health each, two wounds then a
 * KO, exactly as in Ambush. Tiering by wound number rather than by
 * character gives Joshua's "everyone gets wounded fully before anyone goes
 * down": every fighter takes a first wound before any takes a second, and
 * all three fall near the end.
 *
 * The Demon King is four arms, then four claws, then the King himself --
 * the same 4/4/1 ladder KingHuman's TriKing uses, and the same shape of
 * ending, with one vital target left for last.
 *
 * No `element` tags on either side. The humans can't have them for the
 * reason Ambush can't (chooseTargets puts element matches ahead of the
 * whole standing list, tiers included, which would let a KO jump the
 * queue); the King can't because the swarm side is uniform, so there is
 * nothing to prefer. See ambushData.ts.
 */
export const DEMONKING_TARGETS: Record<Side, TrifectaTarget<DemonKingIcon>[]> = {
  humans: [
    { tier: 0 }, // ArcherLegLeft
    { tier: 1 }, // ArcherArmLeft
    { tier: 2 }, // ArcherKO
    { tier: 0 }, // SwordLegRight
    { tier: 1 }, // SwordArmLeft
    { tier: 2 }, // SwordKO
    { tier: 0 }, // ForkArmLeft
    { tier: 1 }, // ForkLegRight
    { tier: 2 }, // ForkKO
  ],
  demons: [
    { tier: 0 }, // ArmBotLeft
    { tier: 0 }, // ArmTopLeft
    { tier: 0 }, // ArmTopRight
    { tier: 0 }, // ArmBotRight
    { tier: 1 }, // ClawBotLeft
    { tier: 1 }, // ClawTopLeft
    { tier: 1 }, // ClawTopRight
    { tier: 1 }, // ClawBotRight
    { tier: 2 }, // DemonKing -- the final kill
  ],
};
