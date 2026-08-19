import type { BarricadeIcon } from '@total-tossup-live/shared';

/**
 * Which icon sits on each of the grid's 8 pairs' O side (left) and X side
 * (right) -- Barricade's own arrangement, keyed by pair index (see
 * shared/src/symbolGrid.ts's resolveGridCell). Hand-transcribed from the
 * BarricadeBoardConfig reference export (Figma node 221:1079) rather than
 * derived, since Figma only exports that reference as one flat picture,
 * not per-cell layers -- same source web's SymbolGrid rendering used to
 * read off a hardcoded copy of this before it started reading it straight
 * off ChannelSnapshot.sheetConfig.arrangement instead.
 *
 * 8 knife cells, 4 medkit, 4 planks -- Josh's own "two knives for every
 * barricade symbol or medkit symbol" ratio.
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
};
