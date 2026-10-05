import type { DrawnStroke } from './TrifectaMarks'

/** One character's marks, in the character's own 1080 box. Paths are
 * emitted unmodified by the extractor and framed by this viewBox, which
 * avoids rewriting path data. */
export interface RpfCharacterMarkArt {
  viewBox: { minX: number; minY: number; size: number }
  /** Alternative drawings of a wound, in authoring order. There are more
   * than any Sheet needs; the arena picks between them per Night. */
  wounds: DrawnStroke[][]
  ko: DrawnStroke[]
}

/** Which mark a given hit draws. The last point of health is always the
 * KO; everything before it is a wound. */
export function markForHit(
  art: RpfCharacterMarkArt,
  hit: number,
  health: number,
  woundOrder: number[],
): DrawnStroke[] {
  if (hit >= health - 1) return art.ko
  return art.wounds[woundOrder[hit % woundOrder.length]]
}
