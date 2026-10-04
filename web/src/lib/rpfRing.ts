/**
 * The Rock Paper Flipper ring's geometry, lifted from Joshua's own
 * Processing renderer (CharacterManager.pde) rather than re-derived.
 * Keeping his constants is what makes the screen match the printed
 * sheets: fighters sit at the same angles, names at the same radius, and
 * the health dots fan out the same way.
 *
 * Everything is a fraction of the ring's own width, so it scales to
 * whatever box it is handed. Shared by RpfArena and RpfArrows so the
 * arrows land on exactly the positions the fighters are drawn at.
 */
export const BUFFER_DEG = 180 * 0.15 // 27deg of dead space at each pole
export const ACTIVE_RANGE = 180 - BUFFER_DEG * 2 // 126deg of arc per side
export const CHARACTER_FRAC = 0.2622
export const SYMBOL_FRAC = CHARACTER_FRAC * 0.2
export const SYMBOL_SHIFT_DEG = (ACTIVE_RANGE / 4) * 0.55
export const NAME_RADIUS_FRAC = 0.5 + CHARACTER_FRAC * 0.175
export const DOT_RADIUS_FRAC = 0.5 + CHARACTER_FRAC * 0.04
export const DOT_GAP_DEG = 7.5
export const DOT_SIZE_FRAC = CHARACTER_FRAC * 0.075

/** The ring graphic is drawn larger than the arena the fighters stand on
 * -- `barDiameter = arenaWidth * 1.1` in the Processing. Missing this
 * rendered the ring 10% tight, so the symbols sat on it rather than
 * inside it. */
export const RING_IMAGE_FRAC = 1.1

/** Radius the fighters' own centres sit at. */
export const CHARACTER_RADIUS_FRAC = 0.5 - CHARACTER_FRAC / 2

/**
 * How much of its box the whole thing occupies.
 *
 * The outermost of Joshua's constants -- the printed names at 0.546, and
 * the ring itself at 0.55 -- sit beyond the arena's own edge, so drawn at
 * full size they overflow the Sheet and clip. One factor across
 * everything keeps his proportions exactly and brings them back inside.
 */
export const RING_SCALE = 0.86

/** Where one lineup slot sits on the ring, in degrees. Index 0 is the
 * bottom of the arc and 3 the top, on both sides -- the order the coin
 * flips address them in. */
export function angleFor(position: number, onLeft: boolean): number {
  const along = (position / 3) * ACTIVE_RANGE
  const normalized = onLeft ? along : ACTIVE_RANGE - along + 180
  return 90 + BUFFER_DEG + normalized
}

/** A ring-relative polar position as a percentage of the box, for CSS. */
export function polar(angleDeg: number, radiusFrac: number) {
  const rad = (angleDeg * Math.PI) / 180
  const r = radiusFrac * RING_SCALE * 100
  return { left: `${50 + Math.cos(rad) * r}%`, top: `${50 + Math.sin(rad) * r}%` }
}

/** The same thing as plain numbers, in a 0-100 space -- what the arrow
 * overlay's SVG viewBox works in. */
export function point(angleDeg: number, radiusFrac: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180
  const r = radiusFrac * RING_SCALE * 100
  return { x: 50 + Math.cos(rad) * r, y: 50 + Math.sin(rad) * r }
}

/** A size in ring-relative units, as a CSS percentage of the box. */
export function span(frac: number): string {
  return `${frac * RING_SCALE * 100}%`
}
