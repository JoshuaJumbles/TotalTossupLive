import type { AmbushIcon, Side, TrifectaCell, TrifectaTarget } from '@total-tossup-live/shared';

function symbols(...icons: AmbushIcon[]): TrifectaCell<AmbushIcon> {
  return { kind: 'symbols', symbols: icons };
}

const TILE: TrifectaCell<AmbushIcon> = { kind: 'trifecta' };

/**
 * Ambush's grid: which cell sits on each of the 8 pairs' O side (left) and
 * X side (right), keyed by pair index (see shared/src/symbolGrid.ts's
 * resolveGridCell). Transcribed from Joshua's AmbushGrid export (Figma
 * node 590:61).
 *
 * The structure is the same skeleton KingHuman uses, which is a good sign
 * the Family generalizes rather than being shaped around its first Sheet:
 * three single-element cells (one per element), three two-element cells
 * (one per distinct pairing -- shotgun+guns, hammer+guns, hammer+shotgun),
 * so each element appears in exactly 3 of the 16 cells; the uniform side
 * holds the other 8 cells with 13 symbols between them.
 *
 * Note `guns` is ONE icon depicting a pair of pistols, not two symbols --
 * which is what makes the per-element counts come out at 3 rather than
 * 4/3/3. Confirmed with Joshua before this was written down.
 *
 * The tile sits on the bottom row here rather than KingHuman's second row
 * (pair 0's X cell plus pair 1's O cell). It still straddles the centre
 * line, so each straddled pair keeps its other cell for the uniform side
 * and the final flip stays a genuine 50/50. TrifectaGrid derives the
 * tile's geometry from whichever cells it covers, so this needed no
 * rendering change.
 */
export const AMBUSH_ARRANGEMENT: Record<number, { o: TrifectaCell<AmbushIcon>; x: TrifectaCell<AmbushIcon> }> = {
  0: { o: symbols('demonface', 'demonface'), x: TILE }, // OOO -- tile, left half
  1: { o: TILE, x: symbols('demonface') }, // OOX -- tile, right half
  2: { o: symbols('demonface', 'demonface'), x: symbols('shotgun') }, // OXO
  3: { o: symbols('hammer'), x: symbols('demonface') }, // OXX
  4: { o: symbols('demonface'), x: symbols('guns') }, // XOO
  5: { o: symbols('hammer', 'shotgun'), x: symbols('demonface', 'demonface') }, // XOX
  6: { o: symbols('shotgun', 'guns'), x: symbols('demonface', 'demonface') }, // XXO
  7: { o: symbols('demonface', 'demonface'), x: symbols('hammer', 'guns') }, // XXX
};

/**
 * Both sides' nine destroyable targets, index-aligned with the mark art in
 * web/src/lib/ambushMarkPaths.ts.
 *
 * Ambush's twist is that the humans aren't nine separate things -- they're
 * three characters at three health each, two wounds then a KO. That needs
 * no engine support at all: a character's three hit points are simply
 * three targets that happen to share a body, and the Night still ends when
 * one side loses all nine.
 *
 * What the tiers do is decide the shape of the defeat. Joshua's call was
 * the "final standoff": every human takes a first wound before any takes a
 * second, and all three go down near the end rather than being picked off
 * one at a time. That falls straight out of tiering by wound number
 * (first wounds 0, second wounds 1, KOs 2) rather than by character --
 * crossOrderFor shuffles within each tier, so which human takes a given
 * wound still varies Night to Night.
 *
 * Deliberately NO `element` on either side, which is worth explaining
 * because KingHuman does use it.
 *
 * Tagging the humans by weapon would turn on the Family's thematic
 * targeting (trifecta.ts's preferredElements), so a hit scored against a
 * shotgun cell would wound the shotgun human. That reads well, but
 * chooseTargets puts element matches ahead of the whole standing list --
 * tiers included -- so once a character's two wounds were used up, a
 * third hit aimed their way would take their KO while the other two
 * humans still stood untouched. That is exactly the "picked off one at a
 * time" shape Joshua ruled out in favour of the final standoff, so the
 * tags stay off until matching can respect tiers.
 *
 * The demons carry no element either, but for a simpler reason: the swarm
 * is uniform, so there is nothing to prefer. They fall through to the
 * Night's shuffled order.
 */
export const AMBUSH_TARGETS: Record<Side, TrifectaTarget<AmbushIcon>[]> = {
  humans: [
    { tier: 0 }, // HammerArmL
    { tier: 1 }, // HammerLegR
    { tier: 2 }, // HammerKO
    { tier: 0 }, // GunArmL
    { tier: 1 }, // GunLegR
    { tier: 2 }, // GunKO
    { tier: 0 }, // ShotgunLegL
    { tier: 1 }, // ShotgunLegR
    { tier: 2 }, // ShotgunKO
  ],
  demons: [{}, {}, {}, {}, {}, {}, {}, {}, {}],
};
