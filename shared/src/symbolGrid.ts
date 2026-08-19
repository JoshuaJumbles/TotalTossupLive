import type { CoinFace } from './family';

/**
 * The Teamwork Family's shared coin-grid mechanic (Josh's own spec): 4 coin
 * flips walk a 4x4 grid of 16 possible results. Flip 1/2 pick the row (0-3,
 * 0 = bottom); flip 3/4 pick the column (0-3, 0 = left). O (tails) reads as
 * 0/left/bottom, X (heads) reads as 1/right/top. Grouping by the first 3
 * flips yields exactly 8 "pairs" -- the 4th flip alone decides which of the
 * pair's two cells (O side or X side) you land on. By the Sheet's own
 * design, every pair holds one human-favoring and one demon-favoring
 * result, never two of the same -- see web's SymbolGrid/symbolGrid.ts for
 * the display-order presentation of this same shape.
 *
 * This is the one piece of that mechanic every Family engine needs to run
 * real rules with: given the 4 resolved flips, which pair (0-7) and which
 * side (O or X) they land on. What that pair+side actually MEANS (which
 * icon, which team it favors) is a per-Sheet config, not this module's
 * concern -- see e.g. worker/src/families/barricadeData.ts.
 */
export interface GridCellResult {
  /** 0-7 -- the first 3 flips read as a binary number, flip 1 = most
   * significant bit, O=0/X=1. */
  pairIndex: number;
  /** Which side of that pair the 4th flip landed on. */
  side: 'o' | 'x';
}

function isHeads(face: CoinFace): boolean {
  return face === 'heads'; // heads = X = 1, tails = O = 0
}

export function resolveGridCell(flips: readonly [CoinFace, CoinFace, CoinFace, CoinFace]): GridCellResult {
  const [f1, f2, f3, f4] = flips;
  const pairIndex = (isHeads(f1) ? 4 : 0) + (isHeads(f2) ? 2 : 0) + (isHeads(f3) ? 1 : 0);
  const side = isHeads(f4) ? 'x' : 'o';
  return { pairIndex, side };
}

/**
 * Whether a specific grid cell (pairIndex+side) is still a reachable
 * outcome given however many of the current round's flips have revealed
 * so far -- the "narrowing focus" a live viewer sees flip by flip (Josh's
 * own Figma reference: BarricadeBoardFlowExample_XOXO, node 221:1147,
 * grays out cells whose own implied bits no longer match a flip that's
 * already landed). `revealedFaces` is the round's flips in sequence;
 * a null/missing entry means that flip hasn't resolved yet, so it can't
 * rule anything out yet -- every cell starts "possible" before the first
 * flip, and exactly one cell (the actual result) stays possible once all
 * 4 have landed.
 */
export function cellIsPossible(pairIndex: number, side: 'o' | 'x', revealedFaces: readonly (CoinFace | null)[]): boolean {
  const impliedHeads = [(pairIndex & 4) !== 0, (pairIndex & 2) !== 0, (pairIndex & 1) !== 0, side === 'x'];
  return impliedHeads.every((expectedHeads, i) => {
    const face = revealedFaces[i];
    return face == null || isHeads(face) === expectedHeads;
  });
}
