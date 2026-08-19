import type { CloudFightIcon } from '@total-tossup-live/shared';

/**
 * Which icon sits on each of the grid's 8 pairs' O side (left) and X side
 * (right) -- CloudFight's own arrangement, keyed by pair index (see
 * shared/src/symbolGrid.ts's resolveGridCell). Transcribed from the real
 * grid-config reference Josh shared (Figma node 262:1380), read at full
 * resolution rather than the blurry inline thumbnail.
 *
 * 4 jetpack, 4 bow, 4 skull, 4 snake -- jetpack+bow combined (8) matches
 * skull's 4 and snake's 4, the same 2:1:1 ratio Barricade's own
 * arrangement uses (8 knife : 4 medkit : 4 planks), just with the
 * attacker's action track split across two icons instead of one.
 */
export const CLOUDFIGHT_ARRANGEMENT: Record<number, { o: CloudFightIcon; x: CloudFightIcon }> = {
  0: { o: 'bow', x: 'snake' }, // OOO
  1: { o: 'bow', x: 'skull' }, // OOX
  2: { o: 'jetpack', x: 'snake' }, // OXO
  3: { o: 'jetpack', x: 'skull' }, // OXX
  4: { o: 'snake', x: 'bow' }, // XOO
  5: { o: 'skull', x: 'bow' }, // XOX
  6: { o: 'snake', x: 'jetpack' }, // XXO
  7: { o: 'skull', x: 'jetpack' }, // XXX
};
