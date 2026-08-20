import type { CloudFightIcon } from '@total-tossup-live/shared'
import type { TeamworkBarLayout } from '../components/TeamworkBars'
import type { TeamworkSheetArt } from '../components/TeamworkNightSheetScreen'
import jetpack from '../assets/cloudfight/symbols/jetpack.png'
import bow from '../assets/cloudfight/symbols/bow.png'
import snake from '../assets/cloudfight/symbols/snake.png'
import skull from '../assets/cloudfight/symbols/skull.png'
import cloudFightScene from '../assets/cloudfight/cloudfight-scene.png'

/** Icon key -> image src, same role as barricadeSheetArt.ts's own icon
 * src map -- the arrangement itself lives in real game config
 * (worker/src/families/cloudFightData.ts's CLOUDFIGHT_ARRANGEMENT),
 * broadcast to every viewer as part of ChannelSnapshot.sheetConfig, so
 * this file is just the art. */
const CLOUDFIGHT_ICON_SRC: Record<CloudFightIcon, string> = {
  jetpack,
  bow,
  snake,
  skull,
}

// Position "1" (nearest/first) at the rightmost x for snake, since the
// scene's own printed numbers ("6 5 4 3 2 1") read left-to-right
// descending. Jetpack/bow's own printed numbers ("1 2 3 4 5 6 7 8") read
// ascending, so position "1" sits at their leftmost x instead -- both
// confirmed against the scene's own art. Skull's defense bar has no
// printed numbers of its own to confirm against directly, so its
// direction was set to match whichever direction the human action bars'
// own #5-8 slots read (the ones it's actually defending) -- confirmed
// correct via Josh's own live-verification pass.
const JETPACK_X = [234, 251, 269, 287, 306, 324, 342, 359, 381]

const CLOUDFIGHT_BAR_LAYOUT: TeamworkBarLayout<CloudFightIcon> = {
  jetpack: {
    side: 'humans',
    cells: JETPACK_X.map((leftPx) => ({ leftPx, topPx: 243, sizePx: 34 })),
  },
  bow: {
    side: 'humans',
    cells: JETPACK_X.map((leftPx) => ({ leftPx, topPx: 274, sizePx: 34 })),
  },
  snake: {
    side: 'demons',
    cells: [123, 102, 80, 59, 37, 2].map((leftPx) => ({ leftPx, topPx: 261, sizePx: 40 })),
  },
  skull: {
    side: 'demons',
    cells: [300, 318, 337, 356, 378].map((leftPx) => ({ leftPx, topPx: 187, sizePx: 30 })),
  },
}

/** CloudFight's own art bundle for the shared TeamworkNightSheetScreen --
 * see that component's own doc comment for what each field is for. Label
 * position is a placeholder pending real visual feedback, same as before
 * this generalization. */
export const CLOUDFIGHT_SHEET_ART: TeamworkSheetArt<CloudFightIcon> = {
  sceneImage: cloudFightScene,
  iconSrc: CLOUDFIGHT_ICON_SRC,
  barLayout: CLOUDFIGHT_BAR_LAYOUT,
  labelLeft: '5%',
  labelTop: '2%',
}
