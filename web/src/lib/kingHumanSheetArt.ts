import type { KingHumanIcon } from '@total-tossup-live/shared'
import type { TrifectaSheetArt } from '../components/TrifectaNightSheetScreen'
import { KINGHUMAN_MARK_ART } from './kingHumanMarkPaths'
import triking from '../assets/kinghuman/symbols/triking.png'
import bigflyer from '../assets/kinghuman/symbols/bigflyer.png'
import axe from '../assets/kinghuman/symbols/axe.png'
import spitter from '../assets/kinghuman/symbols/spitter.png'
import kingHumanScene from '../assets/kinghuman/kinghuman-scene.png'

/** Icon key -> image src. Which icon sits in which grid cell is real game
 * config (worker/src/families/kingHumanData.ts's KINGHUMAN_ARRANGEMENT,
 * broadcast on ChannelSnapshot.sheetConfig), so this file is just art. */
const KINGHUMAN_ICON_SRC: Record<KingHumanIcon, string> = {
  triking,
  bigflyer,
  axe,
  spitter,
}

/** KingHuman's own art bundle for the shared TrifectaNightSheetScreen --
 * see that component's own doc comment for what each field is for. Label
 * position is a placeholder pending real visual feedback, same as every
 * other Sheet's own first pass. */
export const KINGHUMAN_SHEET_ART: TrifectaSheetArt<KingHumanIcon> = {
  sceneImage: kingHumanScene,
  iconSrc: KINGHUMAN_ICON_SRC,
  markArt: KINGHUMAN_MARK_ART,
  labelLeft: '5%',
  labelTop: '2%',
}
