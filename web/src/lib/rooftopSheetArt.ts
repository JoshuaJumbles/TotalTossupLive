import type { RooftopIcon } from '@total-tossup-live/shared'
import type { TeamworkBarLayout } from '../components/TeamworkBars'
import type { TeamworkSheetArt } from '../components/TeamworkNightSheetScreen'
import blast from '../assets/rooftop/symbols/blast.png'
import spear from '../assets/rooftop/symbols/spear.png'
import guns from '../assets/rooftop/symbols/guns.png'
import music from '../assets/rooftop/symbols/music.png'
import crystal from '../assets/rooftop/symbols/crystal.png'
import rooftopScene from '../assets/rooftop/rooftop-scene.png'

/** Icon key -> image src, same role as the other Sheets' own icon src
 * maps -- the arrangement itself lives in real game config
 * (worker/src/families/rooftopData.ts's ROOFTOP_ARRANGEMENT), broadcast
 * to every viewer as part of ChannelSnapshot.sheetConfig, so this file
 * is just the art. */
const ROOFTOP_ICON_SRC: Record<RooftopIcon, string> = {
  blast,
  spear,
  guns,
  music,
  crystal,
}

// Cell centers below are real pixel positions in Figma's own 409x311
// RooftopSheet frame (node 264:1702), transcribed from its own
// DemonFireMarks/HumanDefenseMarks/DemonDefenseMarks/HumanSpearMarks/
// HumanGunMarks coordinates. Unlike every other Sheet, both defense bars
// (music/crystal) here have 9 cells, not 5 -- each cell is one raw mark
// (half a "defended point"), matching rooftopSheet()'s own pushValue:0.5
// config; see TeamworkTrackConfig's own doc comment for the full
// arithmetic writeup. Both defense bars are also laid out in a
// zigzagging two-row pattern in the real art (alternating topPx) rather
// than a single row -- transcribed as-is, cell width/height still
// resolve correctly since each cell carries its own top/left/size.
const BLAST_CELLS = [141, 122, 105, 88, 70, 52, 33, 15, -8].map((leftPx) => ({ leftPx, topPx: 261, sizePx: 34 }))

const MUSIC_CELLS = [
  { leftPx: 86, topPx: 222, sizePx: 24 },
  { leftPx: 79, topPx: 215, sizePx: 24 },
  { leftPx: 67, topPx: 222, sizePx: 24 },
  { leftPx: 59, topPx: 214, sizePx: 24 },
  { leftPx: 46, topPx: 222, sizePx: 24 },
  { leftPx: 39, topPx: 213, sizePx: 24 },
  { leftPx: 27, topPx: 222, sizePx: 24 },
  { leftPx: 20, topPx: 213, sizePx: 24 },
  { leftPx: -3, topPx: 215, sizePx: 29 },
]

const CRYSTAL_CELLS = [
  { leftPx: 299, topPx: 205, sizePx: 24 },
  { leftPx: 305, topPx: 198, sizePx: 24 },
  { leftPx: 317, topPx: 205, sizePx: 24 },
  { leftPx: 322, topPx: 198, sizePx: 24 },
  { leftPx: 335, topPx: 205, sizePx: 24 },
  { leftPx: 341, topPx: 197, sizePx: 24 },
  { leftPx: 354, topPx: 204, sizePx: 24 },
  { leftPx: 359, topPx: 197, sizePx: 24 },
  { leftPx: 375, topPx: 197, sizePx: 31 },
]

const SPEAR_GUN_X = [231, 249, 267, 285, 302, 320, 338, 356, 378]
const SPEAR_CELLS = SPEAR_GUN_X.map((leftPx) => ({ leftPx, topPx: 241, sizePx: 34 }))
const GUN_CELLS = SPEAR_GUN_X.map((leftPx) => ({ leftPx, topPx: 269, sizePx: 34 }))

const ROOFTOP_BAR_LAYOUT: TeamworkBarLayout<RooftopIcon> = {
  spear: { side: 'humans', cells: SPEAR_CELLS },
  guns: { side: 'humans', cells: GUN_CELLS },
  music: { side: 'humans', cells: MUSIC_CELLS },
  blast: { side: 'demons', cells: BLAST_CELLS },
  crystal: { side: 'demons', cells: CRYSTAL_CELLS },
}

/** Rooftop's own art bundle for the shared TeamworkNightSheetScreen --
 * see that component's own doc comment for what each field is for. Label
 * position is a placeholder pending real visual feedback, same as every
 * other Sheet's own first pass. */
export const ROOFTOP_SHEET_ART: TeamworkSheetArt<RooftopIcon> = {
  sceneImage: rooftopScene,
  iconSrc: ROOFTOP_ICON_SRC,
  barLayout: ROOFTOP_BAR_LAYOUT,
  labelLeft: '5%',
  labelTop: '2%',
}
