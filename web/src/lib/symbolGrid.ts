/**
 * The Teamwork Family's shared coin-grid mechanic (Josh's own spec,
 * 2026-08-19): every Barricade-style Sheet resolves a round with 4 coin
 * flips that walk down a 4x4 grid of 16 possible results.
 *
 * - flip 1, flip 2 pick the ROW (0-3, 0 = bottom).
 * - flip 3, flip 4 pick the COLUMN (0-3, 0 = left).
 * - O (tails) = 0, and reads left/bottom; X (heads) = 1, and reads
 *   right/top -- so "OOOO" is the bottom-left cell, "OXOO" is the
 *   leftmost cell of the second row from the bottom, etc.
 *
 * Grouping by the first 3 flips (fixing the row and which HALF of that
 * row -- left pair or right pair) yields exactly 8 "pairs": the last
 * flip alone decides which of the pair's two cells you land on. By the
 * sheet's own design every pair holds one human-favoring and one
 * demon-favoring result, never two of the same -- that's what keeps the
 * outcome undecided until the very last flip. This module only knows the
 * *shape* of that grouping (the 8 labels); which symbol/team each side of
 * a pair maps to is a per-Sheet config, landing in a follow-up.
 */

export type CoinSymbol = 'O' | 'X'

/** One of the 8 pairs the grid is organized into for display: a 3-flip
 * label (e.g. "OXO") plus its own index 0-7 (the label read as a binary
 * number, O=0/X=1, flip 1 as the most-significant bit). */
export interface SymbolPair {
  index: number
  label: string
}

const PAIR_LABEL_BITS = [4, 2, 1] as const

function labelFor(index: number): string {
  return PAIR_LABEL_BITS.map((bit) => (index & bit ? 'X' : 'O')).join('')
}

/** All 8 pairs, index 0-7 ("OOO" through "XXX"). Fixed shape -- nothing
 * here varies per Sheet or Night. */
export const SYMBOL_PAIRS: SymbolPair[] = Array.from({ length: 8 }, (_, index) => ({
  index,
  label: labelFor(index),
}))
