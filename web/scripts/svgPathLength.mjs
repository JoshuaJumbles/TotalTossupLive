// @ts-check
/**
 * Shared by the mark extractors. Measuring at build time is what lets a
 * renderer allocate drawing time across strokes on its very first frame,
 * with no measure-then-reflow pass.
 */
/**
 * Arc length of a path, by flattening it the same way a browser does.
 * Only the commands Joshua's exports actually produce are handled; an
 * unknown one throws rather than silently returning a short length, since
 * a wrong length would quietly skew the animation's pacing rather than
 * breaking visibly.
 */
export function pathLength(d) {
  const tokens = [...d.matchAll(/([MmCcLlHhVvZz])|(-?\d*\.?\d+(?:e-?\d+)?)/g)]
  let length = 0
  let [x, y] = [0, 0]
  let [startX, startY] = [0, 0]
  let command = null
  let args = []

  const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay)

  const cubic = (x1, y1, x2, y2, x3, y3) => {
    // 64 samples holds well under a tenth of a percent on strokes this
    // size, and this runs once at build time, so there's no reason to be
    // cleverer about it.
    const steps = 64
    let total = 0
    let [px, py] = [x, y]
    for (let i = 1; i <= steps; i += 1) {
      const t = i / steps
      const u = 1 - t
      const cx = u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3
      const cy = u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3
      total += dist(px, py, cx, cy)
      ;[px, py] = [cx, cy]
    }
    ;[x, y] = [x3, y3]
    return total
  }

  const flush = () => {
    if (!command) return
    const rel = command === command.toLowerCase()
    switch (command.toUpperCase()) {
      case 'M':
        for (let i = 0; i + 1 < args.length; i += 2) {
          const [nx, ny] = rel ? [x + args[i], y + args[i + 1]] : [args[i], args[i + 1]]
          // Only the first pair is a move; any further pairs are implicit
          // lineto, per the SVG spec.
          if (i > 0) length += dist(x, y, nx, ny)
          ;[x, y] = [nx, ny]
          if (i === 0) [startX, startY] = [nx, ny]
        }
        break
      case 'L':
        for (let i = 0; i + 1 < args.length; i += 2) {
          const [nx, ny] = rel ? [x + args[i], y + args[i + 1]] : [args[i], args[i + 1]]
          length += dist(x, y, nx, ny)
          ;[x, y] = [nx, ny]
        }
        break
      case 'H':
        for (const a of args) {
          const nx = rel ? x + a : a
          length += dist(x, y, nx, y)
          x = nx
        }
        break
      case 'V':
        for (const a of args) {
          const ny = rel ? y + a : a
          length += dist(x, y, x, ny)
          y = ny
        }
        break
      case 'C':
        for (let i = 0; i + 5 < args.length; i += 6) {
          const p = rel
            ? [x + args[i], y + args[i + 1], x + args[i + 2], y + args[i + 3], x + args[i + 4], y + args[i + 5]]
            : args.slice(i, i + 6)
          length += cubic(...p)
        }
        break
      case 'Z':
        length += dist(x, y, startX, startY)
        ;[x, y] = [startX, startY]
        break
      default:
        throw new Error(`Unhandled path command "${command}" -- extend this parser`)
    }
    args = []
  }

  for (const [, letter, number] of tokens) {
    if (letter) {
      flush()
      command = letter
      if (letter.toUpperCase() === 'Z') flush()
    } else {
      args.push(Number(number))
    }
  }
  flush()
  return length
}

