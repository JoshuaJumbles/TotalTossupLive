import type { NightmareIcon, Side, TrifectaCell, TrifectaTarget } from '@total-tossup-live/shared';

function symbols(...icons: NightmareIcon[]): TrifectaCell<NightmareIcon> {
  return { kind: 'symbols', symbols: icons };
}

const TILE: TrifectaCell<NightmareIcon> = { kind: 'trifecta' };

/**
 * Nightmare's grid: which cell sits on each of the 8 pairs' O side (left)
 * and X side (right), keyed by pair index (see shared/src/symbolGrid.ts's
 * resolveGridCell). Transcribed from Joshua's NightmareGrid export.
 *
 * Sixth Sheet, sixth time the skeleton holds: each element in exactly 3 of
 * the 16 cells, three single-element cells plus three two-element cells
 * covering each distinct pairing once (demon+scream, demon+hand,
 * hand+scream), uniform side across 8 cells with 13 symbols. The tile sits
 * on the second row, straddling the centre -- Tentacle Pit's slot.
 */
export const NIGHTMARE_ARRANGEMENT: Record<number, { o: TrifectaCell<NightmareIcon>; x: TrifectaCell<NightmareIcon> }> = {
  0: { o: symbols('star'), x: symbols('demon') }, // OOO
  1: { o: symbols('scream', 'hand'), x: symbols('star', 'star') }, // OOX
  2: { o: symbols('scream'), x: symbols('star', 'star') }, // OXO
  3: { o: symbols('star', 'star'), x: symbols('hand') }, // OXX
  4: { o: symbols('star', 'star'), x: TILE }, // XOO -- tile, left half
  5: { o: TILE, x: symbols('star') }, // XOX -- tile, right half
  6: { o: symbols('demon', 'scream'), x: symbols('star') }, // XXO
  7: { o: symbols('hand', 'demon'), x: symbols('star', 'star') }, // XXX
};

/**
 * Both sides' nine destroyable targets, index-aligned with the mark art in
 * web/src/lib/nightmareMarkPaths.ts.
 *
 * The onslaught is three of each kind -- screaming skulls, floating hands,
 * spiral-faced demons -- at one hit point apiece, the same shape KingHuman
 * and Bomb Squad use. They carry `element` because Joshua wants them
 * targeted by theme: score against a hand and it's a hand that goes.
 * That's safe here for the usual reason, which is that they have no tiers
 * for an element match to jump ahead of (see ambushData.ts).
 *
 * The wizards' side is their shield first, then the wizards. The shield is
 * six arc segments, numbered from the top and running clockwise -- that
 * numbering is how the layers map to positions, not a destruction order,
 * so all six sit in one tier and the Night's own shuffle decides which
 * breaks when. If the shield should instead collapse in clockwise order,
 * that's giving Shield0-5 tiers 0 through 5 and the wizards tier 6,
 * nothing more.
 */
export const NIGHTMARE_TARGETS: Record<Side, TrifectaTarget<NightmareIcon>[]> = {
  humans: [
    { tier: 0 }, // Shield0 -- top, then clockwise
    { tier: 0 }, // Shield1
    { tier: 0 }, // Shield2
    { tier: 0 }, // Shield3
    { tier: 0 }, // Shield4
    { tier: 0 }, // Shield5
    { tier: 1 }, // HumanLeft -- the wizards are the final tier
    { tier: 1 }, // HumanRight
    { tier: 1 }, // HumanBottom
  ],
  demons: [
    { element: 'scream' }, // SkullLeft
    { element: 'scream' }, // SkullTop
    { element: 'scream' }, // SkullRight
    { element: 'hand' }, // HandLeft
    { element: 'hand' }, // HandTop
    { element: 'hand' }, // HandRight
    { element: 'demon' }, // DemonLeft
    { element: 'demon' }, // DemonBottom
    { element: 'demon' }, // DemonRight
  ],
};
