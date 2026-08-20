import type { BarricadeIcon } from '@total-tossup-live/shared'
import type { TeamworkBarLayout } from '../components/TeamworkBars'
import type { TeamworkSheetArt } from '../components/TeamworkNightSheetScreen'
import knife from '../assets/barricade/symbols/knife.png'
import medkit from '../assets/barricade/symbols/medkit.png'
import planks from '../assets/barricade/symbols/planks.png'
import barricadeScene from '../assets/barricade/barricade-scene-lines.png'

/** Icon key -> image src. Just the art -- which icon actually sits on
 * each grid pair's O/X side is real game config (worker/src/families/
 * barricadeData.ts's BARRICADE_ARRANGEMENT), broadcast to every viewer as
 * part of ChannelSnapshot.sheetConfig, so this file doesn't keep its own
 * copy of that. */
const BARRICADE_ICON_SRC: Record<BarricadeIcon, string> = {
  knife,
  medkit,
  planks,
}

/** Cell centers below are real pixel positions in Figma's own 409x311
 * BarricadeScene frame, transcribed from Josh's own reference marks in
 * BarricadeSceneExample (node 221:1080) -- each bar's own array is
 * ordered nearest-to-center (index 0) outward to the uncontestable final
 * cell (last index), matching how the bars actually fill.
 *
 * The mark graphic itself (strikethrough-ink, reused from CrossOutMark)
 * is an explicit placeholder -- Josh's own call: "I will definitely want
 * a different graphic for the eventual 'cross off graphic', but as a
 * reference point for center positions they work fine." */
const BARRICADE_BAR_LAYOUT: TeamworkBarLayout<BarricadeIcon> = {
  medkit: {
    side: 'humans',
    cells: [238, 259, 281, 303, 325, 362].map((leftPx) => ({ leftPx, topPx: 264, sizePx: 43 })),
  },
  knife: {
    side: 'demons',
    cells: [136, 117, 98, 82, 64, 46, 30, 10, -11].map((leftPx) => ({ leftPx, topPx: 264, sizePx: 43 })),
  },
  planks: {
    side: 'humans',
    cells: [74, 57, 39, 21, -1].map((leftPx) => ({ leftPx, topPx: 213, sizePx: 31 })),
  },
}

/** Barricade's own art bundle for the shared TeamworkNightSheetScreen --
 * see that component's own doc comment for what each field is for. Label
 * position is a placeholder pending real visual feedback, same as before
 * this generalization. */
export const BARRICADE_SHEET_ART: TeamworkSheetArt<BarricadeIcon> = {
  sceneImage: barricadeScene,
  iconSrc: BARRICADE_ICON_SRC,
  barLayout: BARRICADE_BAR_LAYOUT,
  labelLeft: '24.7%',
  labelTop: '2.3%',
}
