import type { RiverSharkIcon } from '@total-tossup-live/shared';

/**
 * Which icon sits on each of the grid's 8 pairs' O side (left) and X side
 * (right) -- RiverShark's own arrangement, keyed by pair index (see
 * shared/src/symbolGrid.ts's resolveGridCell). Transcribed from the
 * RiverSharkGridConfig reference export (Figma node 264:1694).
 *
 * 8 shark cells, 4 gun, 4 oar -- the same 8:4:4 ratio as Barricade's own
 * knife/medkit/planks and Inferno's own fire/water/shield (see
 * riverSharkSheet() in presets.ts for the full shape confirmation).
 */
export const RIVERSHARK_ARRANGEMENT: Record<number, { o: RiverSharkIcon; x: RiverSharkIcon }> = {
  0: { o: 'gun', x: 'shark' }, // OOO
  1: { o: 'oar', x: 'shark' }, // OOX
  2: { o: 'shark', x: 'gun' }, // OXO
  3: { o: 'shark', x: 'oar' }, // OXX
  4: { o: 'shark', x: 'gun' }, // XOO
  5: { o: 'shark', x: 'oar' }, // XOX
  6: { o: 'gun', x: 'shark' }, // XXO
  7: { o: 'oar', x: 'shark' }, // XXX
};
