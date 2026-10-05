// @ts-check
/**
 * Turns Joshua's Rock Paper Flipper character-marks export into the typed
 * path data the arena draws.
 *
 * The export is one sheet holding all eight fighters, but it needs no
 * grid assumptions: each character's group carries an <image> whose
 * translate and 1080x1080 box is an explicit anchor, and every mark group
 * is named `{Character}{Mark}`. So a mark only has to know which
 * character's box it belongs to, which the names give directly -- with
 * one catch, that `Princess` has to be matched before `Prince` or her
 * marks get assigned to him.
 *
 * Paths are emitted unmodified and each character gets a viewBox framing
 * its own anchor instead. That avoids rewriting path data, the same trick
 * the Trifecta scene rect uses.
 *
 *   node web/scripts/extract-rpf-marks.mjs
 */
import { readFileSync, writeFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { pathLength } from './svgPathLength.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const SOURCE = resolve(here, '../src/assets/rpf/marks/character-marks.svg')
const OUTPUT = resolve(here, '../src/lib/rpfCharacterMarks.ts')

/**
 * Joshua's layer names to the `art` keys the engine's lineup already uses
 * (worker/src/families/rpfData.ts). The two royals are the only ones that
 * need thought: the sheet's red half is the human court, so `Prince` is
 * the shield princess and `Princess` is the flame princess.
 */
const ART_KEY = {
  Bull: 'minotaur',
  Wizard: 'wizard',
  Prince: 'shieldPrincess',
  Archer: 'centaur',
  Ogre: 'ogre',
  Creature: 'voidBeast',
  Princess: 'flamePrincess',
  Spider: 'spider',
}

let svg = readFileSync(SOURCE, 'utf8')

// The sheet embeds one character's art as base64 and links the rest. None
// of it is needed -- only the <image> rects are -- so the payload goes
// while the elements stay.
const stripped = svg.replace(/(\b(?:xlink:)?href=")[^"]*(")/g, '$1$2')
if (stripped !== svg) {
  const before = statSync(SOURCE).size
  writeFileSync(SOURCE, stripped)
  svg = stripped
  console.log(`  stripped image payloads (${(before / 1e3).toFixed(0)}KB -> ${(stripped.length / 1e3).toFixed(0)}KB)`)
}

const strokeWidth = /stroke-width:\s*([\d.]+)px/.exec(svg)?.[1]
if (!strokeWidth) throw new Error('No stroke-width in the <style> block')

/** Characters are the groups holding an <image>; everything else with a
 * path in it is a mark. */
const anchors = new Map()
const marks = []
for (const [, id, body] of svg.matchAll(/<g id="([^"]+)"[^>]*>([\s\S]*?)<\/g>/g)) {
  const image = /<image[^>]*?>/.exec(body)
  if (image) {
    const attr = (name) => new RegExp(`\\b${name}="([^"]*)"`).exec(image[0])?.[1]
    const move = /translate\(([-\d.]+)[\s,]+([-\d.]+)\)/.exec(attr('transform') ?? '')
    if (!move) throw new Error(`${id}'s image has no translate to anchor against`)
    anchors.set(id, { minX: Number(move[1]), minY: Number(move[2]), size: Number(attr('width')) })
    continue
  }
  const d = /<path[^>]*?\bd="([^"]+)"/.exec(body)
  if (d) marks.push({ id, d: d[1] })
}

const missing = Object.keys(ART_KEY).filter((name) => !anchors.has(name))
if (missing.length > 0) {
  throw new Error(`The export is missing these characters: ${missing.join(', ')}\nIt has: ${[...anchors.keys()].join(', ')}`)
}

// Longest name first, so `Princess*` can't be swallowed by `Prince`.
const byLength = Object.keys(ART_KEY).sort((a, b) => b.length - a.length)

const built = {}
for (const name of Object.keys(ART_KEY)) built[ART_KEY[name]] = { anchor: anchors.get(name), wounds: [], ko: null }

for (const mark of marks) {
  const owner = byLength.find((name) => mark.id.startsWith(name))
  if (!owner) throw new Error(`Mark "${mark.id}" doesn't start with any character's name`)
  const stroke = { d: mark.d, length: Number(pathLength(mark.d).toFixed(2)) }
  const target = built[ART_KEY[owner]]
  // Joshua's naming drifted a little -- WizardWoundKO rather than
  // WizardKO, and PrincessLegR without the "Wound" -- so classify on
  // whether the name ends in KO rather than on an exact scheme.
  if (mark.id.endsWith('KO')) {
    if (target.ko) throw new Error(`${owner} has more than one KO mark`)
    target.ko = [stroke]
  } else {
    target.wounds.push({ id: mark.id.slice(owner.length), strokes: [stroke] })
  }
}

for (const [art, data] of Object.entries(built)) {
  if (!data.ko) throw new Error(`${art} has no KO mark`)
  if (data.wounds.length === 0) throw new Error(`${art} has no wound marks`)
}

const serializeStrokes = (strokes, indent) =>
  `[\n${strokes.map((s) => `${indent}  { length: ${s.length}, d: '${s.d}' },`).join('\n')}\n${indent}]`

const body = Object.entries(built)
  .map(([art, data]) => {
    const wounds = data.wounds
      .map((w) => `      // ${w.id}\n      ${serializeStrokes(w.strokes, '      ')},`)
      .join('\n')
    return `  ${art}: {
    viewBox: { minX: ${data.anchor.minX}, minY: ${data.anchor.minY}, size: ${data.anchor.size} },
    wounds: [
${wounds}
    ],
    ko: ${serializeStrokes(data.ko, '    ')},
  },`
  })
  .join('\n')

writeFileSync(
  OUTPUT,
  `// GENERATED by web/scripts/extract-rpf-marks.mjs -- do not edit by hand.
// Source: web/src/assets/rpf/marks/character-marks.svg
import type { RpfCharacterMarkArt } from '../components/RpfCharacterMarks'

/** Stroke width in a character's own 1080 box. */
export const RPF_MARK_STROKE_WIDTH = ${strokeWidth}

/** Keyed by RpfCharacter.art, so which fighter wears which marks follows
 * the engine's own lineup rather than a second mapping. Each character
 * carries MORE wounds than any Sheet needs -- the renderer picks between
 * them per Night, which is what gives repeat runs some variety. */
export const RPF_CHARACTER_MARKS: Record<string, RpfCharacterMarkArt> = {
${body}
}
`,
)

const woundCounts = Object.entries(built).map(([art, d]) => `${art} ${d.wounds.length}`)
console.log(`  wrote ${OUTPUT.split('/web/')[1]}`)
console.log(`  8 characters, wounds available: ${woundCounts.join(', ')}`)
