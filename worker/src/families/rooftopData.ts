import type { RooftopIcon } from '@total-tossup-live/shared';

/**
 * Which icon sits on each of the grid's 8 pairs' O side (left) and X side
 * (right) -- Rooftop's own arrangement, keyed by pair index (see
 * shared/src/symbolGrid.ts's resolveGridCell). Transcribed from the
 * RooftopGridConfig reference export (Figma node 264:1731).
 *
 * 4 spear+guns (combined), 4 music, 4 blast, 4 crystal -- the 1:1
 * action:defense ratio on both sides that's unique to Rooftop (see
 * rooftopSheet() in presets.ts for the fractional pushValue this drives).
 */
export const ROOFTOP_ARRANGEMENT: Record<number, { o: RooftopIcon; x: RooftopIcon }> = {
  0: { o: 'blast', x: 'spear' }, // OOO
  1: { o: 'guns', x: 'blast' }, // OOX
  2: { o: 'blast', x: 'music' }, // OXO
  3: { o: 'music', x: 'blast' }, // OXX
  4: { o: 'spear', x: 'crystal' }, // XOO
  5: { o: 'crystal', x: 'guns' }, // XOX
  6: { o: 'music', x: 'crystal' }, // XXO
  7: { o: 'crystal', x: 'music' }, // XXX
};
