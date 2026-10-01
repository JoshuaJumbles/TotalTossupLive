import type { BombSquadIcon, Side, TrifectaCell, TrifectaTarget } from '@total-tossup-live/shared';

function symbols(...icons: BombSquadIcon[]): TrifectaCell<BombSquadIcon> {
  return { kind: 'symbols', symbols: icons };
}

const TILE: TrifectaCell<BombSquadIcon> = { kind: 'trifecta' };

/**
 * Bomb Squad's grid: which cell sits on each of the 8 pairs' O side (left)
 * and X side (right), keyed by pair index (see shared/src/symbolGrid.ts's
 * resolveGridCell). Transcribed from Joshua's BombSquadGrid export.
 *
 * Third Sheet, third time the same skeleton shows up: three
 * single-element cells (one per element), three two-element cells (one per
 * distinct pairing -- small+medium, small+large, medium+large), so each
 * element appears in exactly 3 of the 16 cells, with the uniform side
 * holding the other 8 cells and 13 symbols between them. At this point
 * that structure is clearly the Family's rule rather than a coincidence of
 * KingHuman's.
 *
 * The tile sits on the top row here (pair 6's X cell plus pair 7's O
 * cell) -- KingHuman puts it on the second row and Ambush on the bottom.
 * All three needed no rendering change, since TrifectaGrid derives the
 * tile's geometry from whichever cells it covers.
 */
export const BOMBSQUAD_ARRANGEMENT: Record<number, { o: TrifectaCell<BombSquadIcon>; x: TrifectaCell<BombSquadIcon> }> = {
  0: { o: symbols('bomb', 'bomb'), x: symbols('small', 'medium') }, // OOO
  1: { o: symbols('bomb'), x: symbols('small', 'large') }, // OOX
  2: { o: symbols('bomb', 'bomb'), x: symbols('medium') }, // OXO
  3: { o: symbols('bomb', 'bomb'), x: symbols('medium', 'large') }, // OXX
  4: { o: symbols('small'), x: symbols('bomb') }, // XOO
  5: { o: symbols('bomb', 'bomb'), x: symbols('large') }, // XOX
  6: { o: symbols('bomb'), x: TILE }, // XXO -- tile, left half
  7: { o: TILE, x: symbols('bomb', 'bomb') }, // XXX -- tile, right half
};

/**
 * Both sides' nine destroyable targets, index-aligned with the mark art in
 * web/src/lib/bombSquadMarkPaths.ts.
 *
 * The humans are a fortified position rather than nine separate things: a
 * six-segment brick wall, two launchers behind it, and the Holder with the
 * bomb at the back. Tiers give that its shape -- the demons chew through
 * the wall first, take out the launchers, and the Holder is the final
 * kill. Same arc as KingHuman's limbs-then-torso, just built out of
 * emplacements instead of a body.
 *
 * (Joshua's note numbered these the other way round. Confirmed with him:
 * the prose order -- wall, then launchers, then holder -- is what he
 * meant, which is what's encoded here.)
 *
 * The demons carry `element` because this Sheet wants thematic targeting,
 * per Joshua: score against a Large and it's one of the big demon's three
 * eyes that goes. That's safe here in a way it wasn't for Ambush, because
 * the demons have no tiers for an element match to jump ahead of -- see
 * ambushData.ts for why the two features can't currently be combined.
 *
 * Note the Large element is one creature with three eyes rather than
 * three creatures, which needs no special handling at all: three targets
 * that happen to share a body, exactly like an Ambush human's three hit
 * points.
 */
export const BOMBSQUAD_TARGETS: Record<Side, TrifectaTarget<BombSquadIcon>[]> = {
  humans: [
    { tier: 0 }, // Wall0
    { tier: 0 }, // Wall1
    { tier: 0 }, // Wall2
    { tier: 0 }, // Wall3
    { tier: 0 }, // Wall4
    { tier: 0 }, // Wall5
    { tier: 1 }, // LauncherL
    { tier: 1 }, // LauncherR
    { tier: 2 }, // Holder -- the final kill
  ],
  demons: [
    { element: 'small' }, // SmallTop
    { element: 'small' }, // SmallLeft
    { element: 'small' }, // SmallBottom
    { element: 'medium' }, // MediumLeft
    { element: 'medium' }, // MediumCenter
    { element: 'medium' }, // MediumBottom
    { element: 'large' }, // EyeLeftCombo
    { element: 'large' }, // EyeCenterCombo
    { element: 'large' }, // RightEyeCombo
  ],
};
