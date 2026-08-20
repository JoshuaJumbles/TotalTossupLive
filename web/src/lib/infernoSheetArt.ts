import type { InfernoIcon } from '@total-tossup-live/shared'
import type { TeamworkBarLayout } from '../components/TeamworkBars'
import type { TeamworkSheetArt } from '../components/TeamworkNightSheetScreen'
import fire from '../assets/inferno/symbols/fire.png'
import water from '../assets/inferno/symbols/water.png'
import shield from '../assets/inferno/symbols/shield.png'
import infernoScene from '../assets/inferno/inferno-scene.png'

/** Icon key -> image src, same role as barricadeSheetArt.ts's own icon
 * src map -- the arrangement itself lives in real game config
 * (worker/src/families/infernoData.ts's INFERNO_ARRANGEMENT), broadcast
 * to every viewer as part of ChannelSnapshot.sheetConfig, so this file
 * is just the art. */
const INFERNO_ICON_SRC: Record<InfernoIcon, string> = {
  fire,
  water,
  shield,
}

/** Cell centers below are real pixel positions in Figma's own 409x311
 * InfernoSheet frame (node 262:1423), transcribed from its own
 * HumanWaterMarks/DemonFireMarks/HumanShieldMarks coordinates -- the
 * exact same "6 water cells, 9 fire cells, 5 shield cells" shape as
 * Barricade's own medkit/knife/planks bars, just reskinned, confirming
 * the shared 5/6/5 targets (see presets.ts's infernoSheet()). Direction
 * for all three is unconfirmed against printed scene numbers (the scene
 * export doesn't show them at this resolution) -- set to match
 * Barricade's own convention (nearest-to-center first, outward) pending
 * a live look. */
const INFERNO_BAR_LAYOUT: TeamworkBarLayout<InfernoIcon> = {
  water: {
    side: 'humans',
    cells: [239, 261, 283, 305, 326, 360].map((leftPx) => ({ leftPx, topPx: 253, sizePx: 42 })),
  },
  fire: {
    side: 'demons',
    cells: [140, 121, 104, 87, 69, 51, 32, 14, -9].map((leftPx) => ({ leftPx, topPx: 256, sizePx: 34 })),
  },
  shield: {
    side: 'humans',
    cells: [75, 57, 38, 20, -1].map((leftPx) => ({ leftPx, topPx: 200, sizePx: 32 })),
  },
}

/** Inferno's own art bundle for the shared TeamworkNightSheetScreen --
 * see that component's own doc comment for what each field is for. Label
 * position is a placeholder pending real visual feedback, same as
 * Barricade/CloudFight's own first passes. */
export const INFERNO_SHEET_ART: TeamworkSheetArt<InfernoIcon> = {
  sceneImage: infernoScene,
  iconSrc: INFERNO_ICON_SRC,
  barLayout: INFERNO_BAR_LAYOUT,
  labelLeft: '5%',
  labelTop: '2%',
}
