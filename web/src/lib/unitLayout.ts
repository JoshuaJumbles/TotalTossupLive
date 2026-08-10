/** Consecutive units within a column overlap by this fraction of their own
 * size — the "interlocked" look from Josh's Figma BattleSheet1-6 specs
 * (their concrete negative-margin offsets varied per Sheet; this is one
 * consistent ratio applied everywhere). */
export const OVERLAP = 0.28

/** A column closer to the center is lifted by this fraction of the icon
 * size, per column index — the columns "rise toward the middle." Chosen
 * to replace the specs' unpredictable per-Night flip (outer taller than
 * inner on some Nights, shorter on others — Josh's own read: "obvious and
 * silly discrepancies") with one consistent direction. */
export const STAGGER = 0.5

/** How many units sit in each column, column 0 = outermost (nearest the
 * frame edge) through the last = innermost (nearest the opponent's side).
 * Column count grows with N — 1 column up to 3 units, 2 up to 9, 3 beyond
 * — matching the column counts Josh's Battle1-6 Sheets actually used. Any
 * remainder from an uneven split goes to the outer columns first, so the
 * shape grows consistently outward as N rises within a tier, rather than
 * the specs' inconsistent outer/inner size ordering. */
export function columnCounts(n: number): number[] {
  const numColumns = n <= 3 ? 1 : n <= 9 ? 2 : 3
  const base = Math.floor(n / numColumns)
  const remainder = n % numColumns
  return Array.from({ length: numColumns }, (_, i) => base + (i < remainder ? 1 : 0))
}
