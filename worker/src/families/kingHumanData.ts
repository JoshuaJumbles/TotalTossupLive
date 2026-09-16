import type { KingHumanIcon, Side, TrifectaCell, TrifectaTarget } from '@total-tossup-live/shared';

function symbols(...icons: KingHumanIcon[]): TrifectaCell<KingHumanIcon> {
  return { kind: 'symbols', symbols: icons };
}

const TILE: TrifectaCell<KingHumanIcon> = { kind: 'trifecta' };

/**
 * Which cell sits on each of the grid's 8 pairs' O side (left) and X side
 * (right) -- KingHuman's own arrangement, keyed by pair index (see
 * shared/src/symbolGrid.ts's resolveGridCell). Transcribed from the
 * HumanKing board export (Figma node 279:2060).
 *
 * Verified against Joshua's own worked example in TrifectaGridBehaviorExample
 * rather than just read off the picture: OXOX lands on pair 2's X side (the
 * tile's left half), OOOO on pair 0's O side (a lone Axe, 1 damage), OXXO on
 * pair 3's O side (the tile's right half), and XOXO on pair 5's O side
 * (Spitter + BigFlyer, 2 damage) -- all four match the walkthrough exactly.
 *
 * The shape of the demon (Trifecta) side is worth noting, because it looks
 * deliberate rather than incidental: three single-element cells (one per
 * element) and three two-element cells (one per distinct pairing --
 * flyer+axe, flyer+spitter, axe+spitter), so each element appears in
 * exactly 3 of the 16 cells. The TriKing holds the other 8 cells with 13
 * symbols between them, which is what makes the humans faster early and
 * the demons faster once the tile is lit.
 */
export const KINGHUMAN_ARRANGEMENT: Record<number, { o: TrifectaCell<KingHumanIcon>; x: TrifectaCell<KingHumanIcon> }> = {
  0: { o: symbols('axe'), x: symbols('triking', 'triking') }, // OOO
  1: { o: symbols('triking', 'triking'), x: symbols('axe', 'spitter') }, // OOX
  2: { o: symbols('triking', 'triking'), x: TILE }, // OXO -- tile, left half
  3: { o: TILE, x: symbols('triking') }, // OXX -- tile, right half
  4: { o: symbols('bigflyer', 'axe'), x: symbols('triking', 'triking') }, // XOO
  5: { o: symbols('bigflyer', 'spitter'), x: symbols('triking') }, // XOX
  6: { o: symbols('bigflyer'), x: symbols('triking') }, // XXO
  7: { o: symbols('triking', 'triking'), x: symbols('spitter') }, // XXX
};

/**
 * The nine destroyable targets on each side, transcribed from the
 * KingHumanSceneMarkings frame (Figma node 279:2075).
 *
 * Demons are this Sheet's Trifecta side, so their nine are three groups of
 * three -- Joshua's own consistent pattern across every Trifecta Sheet,
 * one group per element (the Figma names them AxeMarks/SpitterMarks/
 * BigFlyerMarks). Humans field the uniform TriKing, so their nine are
 * priority tiers instead (Priority0/1/2 in the Figma): four limbs, then
 * four more, then the single torso space holding the human operators,
 * which is the "final kill" rather than another wound.
 *
 * Index order within a group/tier is the Figma's own layer order for now;
 * it only decides which same-tier target goes first, and a shuffle within
 * each tier is a later step (see trifecta.ts's chooseTargets).
 */
export const KINGHUMAN_TARGETS: Record<Side, TrifectaTarget<KingHumanIcon>[]> = {
  demons: [
    { element: 'bigflyer' },
    { element: 'bigflyer' },
    { element: 'bigflyer' },
    { element: 'axe' },
    { element: 'axe' },
    { element: 'axe' },
    { element: 'spitter' },
    { element: 'spitter' },
    { element: 'spitter' },
  ],
  humans: [
    { tier: 0 },
    { tier: 0 },
    { tier: 0 },
    { tier: 0 },
    { tier: 1 },
    { tier: 1 },
    { tier: 1 },
    { tier: 1 },
    { tier: 2 },
  ],
};
