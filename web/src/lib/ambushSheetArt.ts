import type { AmbushIcon } from '@total-tossup-live/shared'
import type { TrifectaSheetArt } from '../components/TrifectaNightSheetScreen'
import { AMBUSH_MARK_ART } from './ambushMarkPaths'
import demonface from '../assets/ambush/symbols/demonface.png'
import hammer from '../assets/ambush/symbols/hammer.png'
import guns from '../assets/ambush/symbols/guns.png'
import shotgun from '../assets/ambush/symbols/shotgun.png'
import ambushScene from '../assets/ambush/ambush-scene.png'

/** Icon key -> image src. Which icon sits in which grid cell is real game
 * config (worker/src/families/ambushData.ts's AMBUSH_ARRANGEMENT,
 * broadcast on ChannelSnapshot.sheetConfig), so this file is just art.
 * Note `guns` is a single icon showing a pair of pistols. */
const AMBUSH_ICON_SRC: Record<AmbushIcon, string> = {
  demonface,
  hammer,
  guns,
  shotgun,
}

/** Ambush's own art bundle for the shared TrifectaNightSheetScreen -- see
 * that component's own doc comment for what each field is for. Label
 * position is a placeholder pending real visual feedback, same as every
 * other Sheet's own first pass. */
export const AMBUSH_SHEET_ART: TrifectaSheetArt<AmbushIcon> = {
  sceneImage: ambushScene,
  iconSrc: AMBUSH_ICON_SRC,
  markArt: AMBUSH_MARK_ART,
  labelLeft: '5%',
  labelTop: '2%',
}
