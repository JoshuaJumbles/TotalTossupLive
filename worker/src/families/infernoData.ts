import type { InfernoIcon } from '@total-tossup-live/shared';

/**
 * Which icon sits on each of the grid's 8 pairs' O side (left) and X side
 * (right) -- Inferno's own arrangement, keyed by pair index (see
 * shared/src/symbolGrid.ts's resolveGridCell). Transcribed from the
 * InfernoGridConfig reference export (Figma node 262:1528).
 *
 * 8 fire cells, 4 water, 4 shield -- the exact same 8:4:4 ratio as
 * Barricade's own knife/medkit/planks (see infernoSheet() in presets.ts
 * for the full shape confirmation).
 */
export const INFERNO_ARRANGEMENT: Record<number, { o: InfernoIcon; x: InfernoIcon }> = {
  0: { o: 'water', x: 'fire' }, // OOO
  1: { o: 'fire', x: 'water' }, // OOX
  2: { o: 'fire', x: 'shield' }, // OXO
  3: { o: 'shield', x: 'fire' }, // OXX
  4: { o: 'fire', x: 'shield' }, // XOO
  5: { o: 'shield', x: 'fire' }, // XOX
  6: { o: 'water', x: 'fire' }, // XXO
  7: { o: 'fire', x: 'water' }, // XXX
};
