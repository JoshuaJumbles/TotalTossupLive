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
