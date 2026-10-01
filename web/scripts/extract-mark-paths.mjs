// @ts-check
/**
 * Turns Joshua's combined marks SVG into the typed path data the mark
 * animator renders.
 *
 * Joshua authors all of a Sheet's marks as one Illustrator/Figma export --
 * named `<g>` per target, laid out in place over the scene -- so the file
 * carries both the art AND the positions. That's why there's no per-mark
 * geometry table anywhere on the web side: a mark's position lives in its
 * own path coordinates, in the same space as the scene behind it.
 *
 * Re-run this whenever Joshua re-exports (he will -- the line style is
 * still being felt out). It is deliberately a build-time script rather
 * than runtime parsing: path lengths get baked here so the renderer can
 * allocate time across strokes on its very first frame, with no measure-
 * then-reflow pass.
 *
 *   node web/scripts/extract-mark-paths.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const SOURCE = resolve(here, '../src/assets/kinghuman/marks/kinghuman-marks.svg')
const OUTPUT = resolve(here, '../src/lib/kingHumanMarkPaths.ts')

/**
 * Which `<g id>` in the export is which target, in the exact order of that
 * side's own `config.targets` array (worker/src/families/kingHumanData.ts).
 * Index alignment is the whole contract: the engine destroys target N, and
 * the renderer draws marks[side][N].
 *
 * Joshua's layer names and the config's target order were arrived at
 * separately, so this is the one place they're reconciled. A name that
 * stops matching the export fails the run loudly rather than silently
 * rendering nothing.
 */
const TARGET_GROUPS = {
  // The TriKing's nine, in tier order: four Priority0 limbs, four
  // Priority1, then the torso last.
  humans: [
    'UpperLegLeft',
    'UpperArmLeft',
    'UpperArmRight',
    'UpperLegRight',
    'LowerLegLeft',
    'LowerLegRight',
    'ForearmLeft',
    'ForearmRight',
    'Torso',
  ],
  // The three forces' nine, grouped: Big Flyer, then Axe, then Spitter.
  demons: [
    'BigFlyerLeft',
    'BigFlyerCenter',
    'BigFlyerRight',
    'AxeMid',
    'AxeLeft',
    'AxeRight',
    'SpitterRight',
    'SpitterLeft',
    'SpitterCenter',
  ],
}

const svg = readFileSync(SOURCE, 'utf8')

const viewBox = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg)
if (!viewBox) throw new Error('No viewBox on the root <svg>')
const [, vbWidth, vbHeight] = viewBox

// Joshua's export puts stroke-width in a shared CSS class rather than on
// each path, so read it from there instead of per-path attributes.
const strokeWidth = /stroke-width:\s*([\d.]+)px/.exec(svg)?.[1]
if (!strokeWidth) throw new Error('No stroke-width in the <style> block')

/** Every `<g id="...">` with the `d` of each path inside it, in document
 * order -- which is also draw order, since Joshua draws the strokes in the
 * order he means them to appear. */
function groupsFromSvg(source) {
  const found = new Map()
  for (const match of source.matchAll(/<g id="([^"]+)"[^>]*>([\s\S]*?)<\/g>/g)) {
    const [, id, body] = match
    const ds = [...body.matchAll(/<path[^>]*?\bd="([^"]+)"/g)].map((m) => m[1])
    if (ds.length > 0) found.set(id, ds)
  }
  return found
}

/**
 * Arc length of a path, by flattening it the same way a browser does.
 * Only the commands Joshua's exports actually produce are handled; an
 * unknown one throws rather than silently returning a short length, since
 * a wrong length would quietly skew the animation's pacing rather than
 * breaking visibly.
 */
function pathLength(d) {
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

const groups = groupsFromSvg(svg)
const missing = Object.values(TARGET_GROUPS)
  .flat()
  .filter((name) => !groups.has(name))
if (missing.length > 0) {
  throw new Error(
    `The export is missing these target groups: ${missing.join(', ')}\n` +
      `It has: ${[...groups.keys()].join(', ')}`,
  )
}

const marks = {}
let strokeCount = 0
for (const [side, names] of Object.entries(TARGET_GROUPS)) {
  marks[side] = names.map((name) =>
    groups.get(name).map((d) => {
      strokeCount += 1
      return { d, length: Number(pathLength(d).toFixed(2)) }
    }),
  )
}

const serializeMark = (strokes) =>
  `[\n${strokes.map((s) => `      { length: ${s.length}, d: '${s.d}' },`).join('\n')}\n    ]`

const serializeSide = (side) =>
  `${side}: [\n${TARGET_GROUPS[side]
    .map((name, i) => `    // ${i} -- ${name}\n    ${serializeMark(marks[side][i])},`)
    .join('\n')}\n  ]`

const file = `// GENERATED by web/scripts/extract-mark-paths.mjs -- do not edit by hand.
// Source: web/src/assets/kinghuman/marks/kinghuman-marks.svg
// Re-run the script after any re-export; see its doc comment for why the
// positions live in the path data rather than a separate geometry table.
import type { DrawnMarkSet } from '../components/TrifectaMarks'

export const KINGHUMAN_MARK_ART: DrawnMarkSet = {
  viewBoxWidth: ${vbWidth},
  viewBoxHeight: ${vbHeight},
  strokeWidth: ${strokeWidth},
  marks: {
  ${serializeSide('humans')},
  ${serializeSide('demons')},
  },
}
`

writeFileSync(OUTPUT, file)

const totalLength = Object.values(marks)
  .flat(2)
  .reduce((sum, s) => sum + s.length, 0)
console.log(
  `Wrote ${OUTPUT}\n` +
    `  18 targets, ${strokeCount} strokes, ${Math.round(totalLength)} total path units\n` +
    `  viewBox ${vbWidth} x ${vbHeight}, stroke-width ${strokeWidth}`,
)
