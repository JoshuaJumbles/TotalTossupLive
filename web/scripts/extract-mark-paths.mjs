// @ts-check
/**
 * Turns Joshua's combined marks SVGs into the typed path data the mark
 * animator renders, one generated module per Trifecta Sheet.
 *
 * Joshua authors all of a Sheet's marks as one Illustrator/Figma export --
 * named `<g>` per target, laid out in place over the scene -- so the file
 * carries both the art AND the positions. That's why there's no per-mark
 * geometry table anywhere on the web side: a mark's position lives in its
 * own path coordinates, in the same space as the scene behind it.
 *
 * Re-run after any re-export; adding a Sheet means one SHEETS entry.
 *
 *   node web/scripts/extract-mark-paths.mjs            # every Sheet
 *   node web/scripts/extract-mark-paths.mjs ambush     # just one
 *
 * A raw export carries the scene as a base64 image, which runs to tens of
 * megabytes. This strips that payload in place on first run while keeping
 * the <image> element itself, because its width/height/transform are what
 * say where the scene sits -- see sceneRect below. So dropping a fresh
 * export straight into the repo and running this is the whole workflow.
 */
import { readFileSync, writeFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const asset = (p) => resolve(here, '../src/assets', p)
const lib = (p) => resolve(here, '../src/lib', p)

/**
 * Each Sheet's export, and which `<g id>` in it is which target.
 *
 * The group lists are in the exact order of that side's own
 * `config.targets` array (worker/src/families/*Data.ts). Index alignment
 * is the whole contract: the engine destroys target N, and the renderer
 * draws marks[side][N]. Joshua's layer names and the config's target
 * order are arrived at separately, so this is the one place they get
 * reconciled -- and a name that stops matching fails the run loudly
 * rather than silently rendering nothing.
 */
const SHEETS = {
  kinghuman: {
    source: asset('kinghuman/marks/kinghuman-marks.svg'),
    output: lib('kingHumanMarkPaths.ts'),
    exportName: 'KINGHUMAN_MARK_ART',
    targets: {
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
    },
  },
  ambush: {
    source: asset('ambush/marks/ambush-marks.svg'),
    output: lib('ambushMarkPaths.ts'),
    exportName: 'AMBUSH_MARK_ART',
    targets: {
      // Three humans at three health each: two wounds then a KO. Grouped
      // by character here, but the TIER in ambushData.ts is what decides
      // ordering -- wounds across all three before any KO.
      humans: [
        'HammerArmL',
        'HammerLegR',
        'HammerKO',
        'GunArmL',
        'GunLegR',
        'GunKO',
        'ShotgunLegL',
        'ShotgunLegR',
        'ShotgunKO',
      ],
      // Nine demons at one health each, indexed from the scene's top left
      // across and then down, which is how Joshua numbered the layers.
      demons: ['Demon0', 'Demon1', 'Demon2', 'Demon3', 'Demon4', 'Demon5', 'Demon6', 'Demon7', 'Demon8'],
    },
  },
}

/**
 * The rect the marks were drawn over, in the export's own coordinates.
 *
 * Normally that's just the viewBox, but an export can carry padding the
 * scene itself doesn't occupy -- Ambush's viewBox is 6.87 units wider
 * than its scene, which would otherwise shift every mark left by that
 * much. When the embedded scene image agrees with the viewBox's shape and
 * very nearly fills it, trust the image: it IS the scene. When it doesn't
 * (KingHuman's export carries one at a different scale, covering about
 * two thirds of the frame) it isn't a usable reference, so fall back to
 * the viewBox, which is what that Sheet was already rendering against.
 */
function sceneRect(svg) {
  const vb = /viewBox="([\d.\s-]+)"/.exec(svg)
  if (!vb) throw new Error('No viewBox on the root <svg>')
  const [vx, vy, vw, vh] = vb[1].trim().split(/\s+/).map(Number)
  const fallback = { minX: vx, minY: vy, width: vw, height: vh }

  const image = /<image[^>]*?>/.exec(svg)
  if (!image) return fallback
  const attr = (name) => new RegExp(`\\b${name}="([^"]*)"`).exec(image[0])?.[1]
  const w = Number(attr('width'))
  const h = Number(attr('height'))
  const transform = attr('transform') ?? ''
  const scale = Number(/scale\(([\d.]+)\)/.exec(transform)?.[1] ?? 1)
  const move = /translate\(([-\d.]+)(?:[\s,]+([-\d.]+))?\)/.exec(transform)
  if (!w || !h || !scale) return fallback

  const rect = {
    minX: Number(move?.[1] ?? 0),
    minY: Number(move?.[2] ?? 0),
    width: w * scale,
    height: h * scale,
  }
  const sameShape = Math.abs(rect.width / rect.height / (vw / vh) - 1) < 0.01
  const fills = (rect.width * rect.height) / (vw * vh) > 0.95
  return sameShape && fills ? rect : fallback
}

/** Every `<g id="...">` with the `d` of each path inside it, in document
 * order -- which is also draw order, since Joshua draws the strokes in
 * the order he means them to appear. */
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

function build(name, sheet) {
  let svg = readFileSync(sheet.source, 'utf8')

  // Drop the scene's base64 payload but keep the <image> element, since
  // its geometry is what sceneRect reads.
  const stripped = svg.replace(/(\b(?:xlink:)?href=")data:[^"]*(")/g, '$1$2')
  if (stripped !== svg) {
    const before = statSync(sheet.source).size
    writeFileSync(sheet.source, stripped)
    svg = stripped
    console.log(
      `  stripped embedded scene from ${name}-marks.svg (${(before / 1e6).toFixed(1)}MB -> ${(stripped.length / 1e3).toFixed(1)}KB)`,
    )
  }

  const rect = sceneRect(svg)
  const strokeWidth = /stroke-width:\s*([\d.]+)px/.exec(svg)?.[1]
  if (!strokeWidth) throw new Error(`No stroke-width in ${name}'s <style> block`)

  const groups = groupsFromSvg(svg)
  const missing = Object.values(sheet.targets)
    .flat()
    .filter((group) => !groups.has(group))
  if (missing.length > 0) {
    throw new Error(
      `${name}'s export is missing these target groups: ${missing.join(', ')}\n` +
        `It has: ${[...groups.keys()].join(', ')}`,
    )
  }

  const marks = {}
  let strokes = 0
  for (const [side, names] of Object.entries(sheet.targets)) {
    marks[side] = names.map((group) =>
      groups.get(group).map((d) => {
        strokes += 1
        return { d, length: Number(pathLength(d).toFixed(2)) }
      }),
    )
  }

  const serializeSide = (side) =>
    `${side}: [\n${sheet.targets[side]
      .map(
        (group, i) =>
          `    // ${i} -- ${group}\n    [\n${marks[side][i]
            .map((s) => `      { length: ${s.length}, d: '${s.d}' },`)
            .join('\n')}\n    ],`,
      )
      .join('\n')}\n  ]`

  writeFileSync(
    sheet.output,
    `// GENERATED by web/scripts/extract-mark-paths.mjs -- do not edit by hand.
// Source: ${sheet.source.split('/src/')[1] ? 'web/src/' + sheet.source.split('/src/')[1] : sheet.source}
// Re-run the script after any re-export; see its doc comment for why the
// positions live in the path data rather than a separate geometry table.
import type { DrawnMarkSet } from '../components/TrifectaMarks'

export const ${sheet.exportName}: DrawnMarkSet = {
  viewBox: { minX: ${rect.minX}, minY: ${rect.minY}, width: ${rect.width}, height: ${rect.height} },
  strokeWidth: ${strokeWidth},
  marks: {
  ${serializeSide('humans')},
  ${serializeSide('demons')},
  },
}
`,
  )

  console.log(
    `  ${name}: 18 targets, ${strokes} strokes, scene rect ${rect.width}x${rect.height} at ${rect.minX},${rect.minY}, stroke-width ${strokeWidth}`,
  )
}

const only = process.argv[2]
if (only && !SHEETS[only]) {
  throw new Error(`Unknown Sheet "${only}" -- known: ${Object.keys(SHEETS).join(', ')}`)
}
for (const [name, sheet] of Object.entries(SHEETS)) {
  if (only && name !== only) continue
  build(name, sheet)
}
