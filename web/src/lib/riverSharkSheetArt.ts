import type { RiverSharkIcon } from '@total-tossup-live/shared'
import type { TeamworkBarLayout } from '../components/TeamworkBars'
import type { TeamworkSheetArt } from '../components/TeamworkNightSheetScreen'
import gun from '../assets/rivershark/symbols/gun.png'
import shark from '../assets/rivershark/symbols/shark.png'
import oar from '../assets/rivershark/symbols/oar.png'
import riverSharkScene from '../assets/rivershark/rivershark-scene-lines.png'

/** Icon key -> image src, same role as the other Sheets' own icon src
 * maps -- the arrangement itself lives in real game config
 * (worker/src/families/riverSharkData.ts's RIVERSHARK_ARRANGEMENT),
 * broadcast to every viewer as part of ChannelSnapshot.sheetConfig, so
 * this file is just the art. */
const RIVERSHARK_ICON_SRC: Record<RiverSharkIcon, string> = {
  gun,
  shark,
  oar,
}

/** Cell centers below are real pixel positions in Figma's own 409x311
 * RiverSharkSheet frame (node 264:1665), transcribed from its own
 * HumanGunMarks/DemonSharkMarks/HumanOarMarks coordinates -- the exact
 * same "6 gun cells, 9 shark cells, 5 oar cells" shape as Barricade's
 * own medkit/knife/planks bars (and Inferno's water/fire/shield), just
 * reskinned, confirming the shared 5/6/5 targets (see presets.ts's
 * riverSharkSheet()). Direction for all three is unconfirmed against
 * printed scene numbers at this resolution -- set to match Barricade's
 * own convention (nearest-to-center first, outward) pending a live look. */
const RIVERSHARK_BAR_LAYOUT: TeamworkBarLayout<RiverSharkIcon> = {
  gun: {
    side: 'humans',
    cells: [129, 108, 86, 65, 43, 8].map((leftPx) => ({ leftPx, topPx: 266, sizePx: 42 })),
  },
  shark: {
    side: 'demons',
    cells: [237, 255, 273, 289, 308, 326, 345, 362, 381].map((leftPx) => ({ leftPx, topPx: 268, sizePx: 36 })),
  },
  oar: {
    side: 'humans',
    cells: [302, 320, 338, 355, 378].map((leftPx) => ({ leftPx, topPx: 211, sizePx: 36 })),
  },
}

/** RiverShark's own art bundle for the shared TeamworkNightSheetScreen --
 * see that component's own doc comment for what each field is for. Label
 * position is a placeholder pending real visual feedback, same as every
 * other Sheet's own first pass. */
export const RIVERSHARK_SHEET_ART: TeamworkSheetArt<RiverSharkIcon> = {
  sceneImage: riverSharkScene,
  iconSrc: RIVERSHARK_ICON_SRC,
  barLayout: RIVERSHARK_BAR_LAYOUT,
  labelLeft: '5%',
  labelTop: '2%',
}
