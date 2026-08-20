import type { PortalIcon } from '@total-tossup-live/shared';

/**
 * Which icon sits on each of the grid's 8 pairs' O side (left) and X side
 * (right) -- Portal's own arrangement, keyed by pair index (see
 * shared/src/symbolGrid.ts's resolveGridCell). Transcribed from the
 * PortalGridConfig reference export (Figma node 262:1637).
 *
 * Each of the 4 icons appears in exactly 4 of the 16 cells -- bat+chain
 * combined (demons' split action track) total 8, the same weight as
 * book (4) and ladder (4), matching every other Sheet's own 8:4:4 ratio
 * (see portalSheet() in presets.ts for the full shape confirmation).
 */
export const PORTAL_ARRANGEMENT: Record<number, { o: PortalIcon; x: PortalIcon }> = {
  0: { o: 'book', x: 'chain' }, // OOO
  1: { o: 'chain', x: 'book' }, // OOX
  2: { o: 'bat', x: 'book' }, // OXO
  3: { o: 'book', x: 'bat' }, // OXX
  4: { o: 'chain', x: 'ladder' }, // XOO
  5: { o: 'ladder', x: 'chain' }, // XOX
  6: { o: 'bat', x: 'ladder' }, // XXO
  7: { o: 'ladder', x: 'bat' }, // XXX
};
