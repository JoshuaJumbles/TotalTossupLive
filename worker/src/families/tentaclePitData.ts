import type { Side, TentaclePitIcon, TrifectaCell, TrifectaTarget } from '@total-tossup-live/shared';

function symbols(...icons: TentaclePitIcon[]): TrifectaCell<TentaclePitIcon> {
  return { kind: 'symbols', symbols: icons };
}

const TILE: TrifectaCell<TentaclePitIcon> = { kind: 'trifecta' };

/**
 * Tentacle Pit's grid: which cell sits on each of the 8 pairs' O side
 * (left) and X side (right), keyed by pair index (see
 * shared/src/symbolGrid.ts's resolveGridCell). Transcribed from Joshua's
 * TentaclePitGrid export.
 *
 * That export is missing the layer that draws the Trifecta tile's own
 * box, so the tile reads as four loose icons on the grid picture. Joshua
 * confirmed its real position: the second row down, straddling the centre
 * -- pair 4's X cell and pair 5's O cell -- and the drill/claw/gun icons
 * sitting there are the tile's contents rather than four separate
 * symbols.
 *
 * Worth recording why that's certainly right rather than merely what we
 * were told: reading those two cells as ordinary symbol cells gives each
 * element 4 cells, 4 single plus 4 paired cells, and claw+gun duplicated.
 * Reading them as the tile gives exactly the skeleton all three other
 * Sheets share -- each element in 3 of 16 cells, three single-element
 * cells plus three two-element cells covering each distinct pairing once,
 * uniform side across 8 cells with 13 symbols. The numbers only resolve
 * one way.
 */
export const TENTACLEPIT_ARRANGEMENT: Record<number, { o: TrifectaCell<TentaclePitIcon>; x: TrifectaCell<TentaclePitIcon> }> = {
  0: { o: symbols('drill', 'claw'), x: symbols('demonface', 'demonface') }, // OOO
  1: { o: symbols('drill', 'gun'), x: symbols('demonface') }, // OOX
  2: { o: symbols('demonface', 'demonface'), x: symbols('claw') }, // OXO
  3: { o: symbols('demonface', 'demonface'), x: symbols('claw', 'gun') }, // OXX
  4: { o: symbols('demonface', 'demonface'), x: TILE }, // XOO -- tile, left half
  5: { o: TILE, x: symbols('demonface') }, // XOX -- tile, right half
  6: { o: symbols('drill'), x: symbols('demonface') }, // XXO
  7: { o: symbols('gun'), x: symbols('demonface', 'demonface') }, // XXX
};

/**
 * Both sides' nine destroyable targets, index-aligned with the mark art in
 * web/src/lib/tentaclePitMarkPaths.ts.
 *
 * The humans are the USS Tripod, a crewed machine vessel, and it comes
 * apart from the outside in: the three non-critical elbows first, then the
 * five tools it fights with (two claws, two guns, the drill), then the
 * hull as the final kill. Note there are elbows for the claws and the
 * drill but not the guns, which is simply what the art has.
 *
 * No `element` tags on the ship, for the same reason Ambush has none:
 * chooseTargets puts element matches ahead of the whole standing list,
 * tiers included, so tagging the tools by weapon would let a gun be shot
 * off while the elbows were still intact. See ambushData.ts.
 *
 * The tentacles carry no tiers -- Joshua's call, "all tier 0 assuming we
 * don't want to play with proximity". Ordering them by how near the pit's
 * edge they are is his own idea for later; the data shape already allows
 * it, since it's just tier numbers.
 */
export const TENTACLEPIT_TARGETS: Record<Side, TrifectaTarget<TentaclePitIcon>[]> = {
  humans: [
    { tier: 0 }, // ClawElbowLeft
    { tier: 0 }, // ClawElbowRight
    { tier: 0 }, // DrillElbow
    { tier: 1 }, // ClawLeft
    { tier: 1 }, // ClawRight
    { tier: 1 }, // Drill
    { tier: 1 }, // GunLeft
    { tier: 1 }, // GunRight
    { tier: 2 }, // Hull -- the final kill
  ],
  demons: [{}, {}, {}, {}, {}, {}, {}, {}, {}],
};
