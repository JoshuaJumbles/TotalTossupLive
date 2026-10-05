/**
 * Picking between alternative drawings of the same mark.
 *
 * Joshua authors more wounds than any Sheet needs so repeat runs don't
 * look identical -- the hand-drawn feel partly comes from a mark not
 * being in quite the same place twice. The choice has to be the same for
 * every viewer and the same after a reconnect, so it can't be random at
 * render time.
 *
 * It is derived rather than stored. Trifecta's cross order lives in
 * NightState because it decides what actually happens; which drawing of a
 * wound gets used decides nothing, so hashing a stable key keeps it out
 * of the engine, out of the snapshot, and out of every Family's state
 * shape. Include the Night's own coordinates in the key and it still
 * varies run to run, which is the whole point. If a Family ever needs the
 * choice to affect play, that is the moment it moves into state.
 */

/** FNV-1a. Small, fast, and stable across runs and machines -- which is
 * all that is being asked of it. */
function hash(key: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < key.length; i += 1) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** One of `count` options, chosen stably for `key`. */
export function variantFor(key: string, count: number): number {
  if (count <= 1) return 0
  return hash(key) % count
}

/**
 * A stable ordering of `count` options for `key` -- a deterministic
 * shuffle, so a character taking several wounds in a Night draws a
 * different one each time rather than repeating the same drawing.
 *
 * Fisher-Yates driven by successive hashes of the key, which keeps it
 * dependent on the whole key rather than on one number's low bits.
 */
export function variantOrder(key: string, count: number): number[] {
  const order = Array.from({ length: count }, (_, i) => i)
  for (let i = count - 1; i > 0; i -= 1) {
    const j = hash(`${key}:${i}`) % (i + 1)
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return order
}
