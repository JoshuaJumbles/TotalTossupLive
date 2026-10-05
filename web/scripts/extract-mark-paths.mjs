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
import { pathLength } from './svgPathLength.mjs'

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
  bombsquad: {
    source: asset('bombsquad/marks/bombsquad-marks.svg'),
    output: lib('bombSquadMarkPaths.ts'),
    exportName: 'BOMBSQUAD_MARK_ART',
    targets: {
      // The fortified position, in the order it falls: the six wall
      // segments, then the two launchers, then the Holder.
      humans: [
        'Wall0',
        'Wall1',
        'Wall2',
        'Wall3',
        'Wall4',
        'Wall5',
        'LauncherL',
        'LauncherR',
        'Holder',
      ],
      // Three sizes of demon. The three `Eye` groups are the big one's
      // three eyes -- one creature holding three targets, which is why
      // they're the only two-stroke marks in this export.
      demons: [
        'SmallTop',
        'SmallLeft',
        'SmallBottom',
        'MediumLeft',
        'MediumCenter',
        'MediumBottom',
        'EyeLeftCombo',
        'EyeCenterCombo',
        'RightEyeCombo',
      ],
    },
  },
  tentaclepit: {
    source: asset('tentaclepit/marks/tentaclepit-marks.svg'),
    output: lib('tentaclePitMarkPaths.ts'),
    exportName: 'TENTACLEPIT_MARK_ART',
    targets: {
      // The USS Tripod, in the order it comes apart: three non-critical
      // elbows, then the five tools, then the hull. There are elbows for
      // the claws and the drill but not the guns -- that's what the art
      // has, not an omission here.
      humans: [
        'ClawElbowLeft',
        'ClawElbowRight',
        'DrillElbow',
        'ClawLeft',
        'ClawRight',
        'Drill',
        'GunLeft',
        'GunRight',
        'Hull',
      ],
      demons: [
        'Tentacle0',
        'Tentacle1',
        'Tentacle2',
        'Tentacle3',
        'Tentacle4',
        'Tentacle5',
        'Tentacle6',
        'Tentacle7',
        'Tentacle8',
      ],
    },
  },
  demonking: {
    source: asset('demonking/marks/demonking-marks.svg'),
    output: lib('demonKingMarkPaths.ts'),
    exportName: 'DEMONKING_MARK_ART',
    targets: {
      // Three fighters at three health each, grouped by character. The
      // TIER in demonKingData.ts is what orders them -- every fighter
      // wounded twice before any KO.
      humans: [
        'ArcherLegLeft',
        'ArcherArmLeft',
        'ArcherKO',
        'SwordLegRight',
        'SwordArmLeft',
        'SwordKO',
        'ForkArmLeft',
        'ForkLegRight',
        'ForkKO',
      ],
      // The King: four arms, then four claws, then the King himself.
      // Joshua's export interleaves arm and claw layers, so these are
      // listed in tier order rather than export order -- this list is what
      // defines the index mapping, not the file.
      demons: [
        'ArmBotLeft',
        'ArmTopLeft',
        'ArmTopRight',
        'ArmBotRight',
        'ClawBotLeft',
        'ClawTopLeft',
        'ClawTopRight',
        'ClawBotRight',
        'DemonKing',
      ],
    },
  },
  nightmare: {
    source: asset('nightmare/marks/nightmare-marks.svg'),
    output: lib('nightmareMarkPaths.ts'),
    exportName: 'NIGHTMARE_MARK_ART',
    targets: {
      // The shield first, numbered from the top and running clockwise,
      // then the three wizards inside it.
      humans: [
        'Shield0',
        'Shield1',
        'Shield2',
        'Shield3',
        'Shield4',
        'Shield5',
        'HumanLeft',
        'HumanRight',
        'HumanBottom',
      ],
      // Three of each kind. The skull layers are named Skull* while the
      // icon is `scream`, which is just Joshua's two names for the same
      // screaming skull.
      demons: [
        'SkullLeft',
        'SkullTop',
        'SkullRight',
        'HandLeft',
        'HandTop',
        'HandRight',
        'DemonLeft',
        'DemonBottom',
        'DemonRight',
      ],
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
  // Judge the image on how much of the frame it covers, NOT on whether
  // its aspect matches the viewBox's: the padding we're here to correct
  // for is exactly what makes those aspects differ, so an aspect test
  // rejects the very cases it should catch (Bomb Squad's 30.8 units of
  // left padding throw the ratio out by 1.7%). A stale or mis-scaled
  // image, which is what the guard is really for, shows up instead as a
  // frame it doesn't come close to filling -- KingHuman's export carries
  // one at 83% on both axes, and marks there run well past its right
  // edge, so it plainly isn't the reference.
  const covers = rect.width / vw > 0.9 && rect.height / vh > 0.9
  return covers ? rect : fallback
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
