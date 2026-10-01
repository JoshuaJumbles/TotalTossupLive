import type { DemonKingIcon } from '@total-tossup-live/shared'
import type { TrifectaSheetArt } from '../components/TrifectaNightSheetScreen'
import { DEMONKING_MARK_ART } from './demonKingMarkPaths'
import demonface from '../assets/demonking/symbols/demonface.png'
import bow from '../assets/demonking/symbols/bow.png'
import swords from '../assets/demonking/symbols/swords.png'
import fork from '../assets/demonking/symbols/fork.png'
import demonKingScene from '../assets/demonking/demonking-scene.png'

/** Icon key -> image src. Which icon sits in which grid cell is real game
 * config (worker/src/families/demonKingData.ts's DEMONKING_ARRANGEMENT,
 * broadcast on ChannelSnapshot.sheetConfig), so this file is just art. */
const DEMONKING_ICON_SRC: Record<DemonKingIcon, string> = {
  demonface,
  bow,
  swords,
  fork,
}

/** Demon King's own art bundle for the shared TrifectaNightSheetScreen --
 * see that component's own doc comment for what each field is for. Label
 * position is a placeholder pending real visual feedback, same as every
 * other Sheet's own first pass. */
export const DEMONKING_SHEET_ART: TrifectaSheetArt<DemonKingIcon> = {
  sceneImage: demonKingScene,
  iconSrc: DEMONKING_ICON_SRC,
  markArt: DEMONKING_MARK_ART,
  labelLeft: '5%',
  labelTop: '2%',
}
