import type { TentaclePitIcon } from '@total-tossup-live/shared'
import type { TrifectaSheetArt } from '../components/TrifectaNightSheetScreen'
import { TENTACLEPIT_MARK_ART } from './tentaclePitMarkPaths'
import demonface from '../assets/tentaclepit/symbols/demonface.png'
import drill from '../assets/tentaclepit/symbols/drill.png'
import claw from '../assets/tentaclepit/symbols/claw.png'
import gun from '../assets/tentaclepit/symbols/gun.png'
import tentaclePitScene from '../assets/tentaclepit/tentaclepit-scene.png'

/** Icon key -> image src. Which icon sits in which grid cell is real game
 * config (worker/src/families/tentaclePitData.ts's
 * TENTACLEPIT_ARRANGEMENT, broadcast on ChannelSnapshot.sheetConfig), so
 * this file is just art. */
const TENTACLEPIT_ICON_SRC: Record<TentaclePitIcon, string> = {
  demonface,
  drill,
  claw,
  gun,
}

/** Tentacle Pit's own art bundle for the shared TrifectaNightSheetScreen
 * -- see that component's own doc comment for what each field is for.
 * Label position is a placeholder pending real visual feedback, same as
 * every other Sheet's own first pass. */
export const TENTACLEPIT_SHEET_ART: TrifectaSheetArt<TentaclePitIcon> = {
  sceneImage: tentaclePitScene,
  iconSrc: TENTACLEPIT_ICON_SRC,
  markArt: TENTACLEPIT_MARK_ART,
  labelLeft: '5%',
  labelTop: '2%',
}
