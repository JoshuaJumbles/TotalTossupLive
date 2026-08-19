import knife from '../assets/barricade/symbols/knife.png'
import medkit from '../assets/barricade/symbols/medkit.png'
import planks from '../assets/barricade/symbols/planks.png'

export type BarricadeIcon = 'knife' | 'medkit' | 'planks'

export const BARRICADE_ICON_SRC: Record<BarricadeIcon, string> = {
  knife,
  medkit,
  planks,
}

/**
 * Which icon sits on each SYMBOL_PAIRS entry's O side (left cell) and X
 * side (right cell) -- Barricade's own grid arrangement, keyed by the
 * pair's `index` (see symbolGrid.ts). Hand-transcribed from the
 * BarricadeBoardConfig reference export (Figma node 221:1079, the same
 * flat image the original barricade-board.png asset was) rather than
 * derived, since Figma only exports that reference as one baked picture,
 * not per-cell layers.
 *
 * 8 knife cells, 4 medkit, 4 planks -- Josh's own "two knives for every
 * barricade symbol or medkit symbol" ratio. This is a per-Sheet config, not
 * something symbolGrid.ts's own math determines: every round draws one of
 * the 16 cells fresh (a new set of 4 coin flips, independent each round),
 * so a 4-cell icon count doesn't cap how many total hits you can
 * accumulate toward the actual score bars over a Night -- that scoring is
 * a later step, not built yet (see BarricadeNightSheetScreen's own note).
 */
export const BARRICADE_ARRANGEMENT: Record<number, { o: BarricadeIcon; x: BarricadeIcon }> = {
  0: { o: 'knife', x: 'planks' }, // OOO
  1: { o: 'knife', x: 'medkit' }, // OOX
  2: { o: 'medkit', x: 'knife' }, // OXO
  3: { o: 'planks', x: 'knife' }, // OXX
  4: { o: 'planks', x: 'knife' }, // XOO
  5: { o: 'medkit', x: 'knife' }, // XOX
  6: { o: 'knife', x: 'medkit' }, // XXO
  7: { o: 'knife', x: 'planks' }, // XXX
}
