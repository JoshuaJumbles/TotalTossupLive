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

/** Display order confirmed against the real BarricadeBoardConfig reference
 * (Figma node 221:1079, pulled once Figma reconnected): 2 physical display
 * columns of 4, split by the label's own 3rd character (row's "which half"
 * bit) -- O-ending labels down the left column, X-ending down the right --
 * and within each column, ROW descending (top of the list = the highest
 * row index, since that's the row nearest the top of the spatial grid).
 * This is a presentation order only; `index` above stays the true binary
 * value (O=0/X=1, flip 1 = most-significant bit) for use as a lookup key
 * into a per-Sheet icon arrangement (see e.g. lib/barricadeSymbols.ts). */
const DISPLAY_ORDER = [6, 4, 2, 0, 7, 5, 3, 1] as const

/** All 8 pairs, in real display order (see DISPLAY_ORDER above). Fixed
 * shape -- nothing here varies per Sheet or Night; which icon goes on each
 * pair's O/X side is a separate, per-Sheet concern. */
export const SYMBOL_PAIRS: SymbolPair[] = DISPLAY_ORDER.map((index) => ({
  index,
  label: labelFor(index),
}))
