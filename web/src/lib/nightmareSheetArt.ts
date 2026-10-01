import type { NightmareIcon } from '@total-tossup-live/shared'
import type { TrifectaSheetArt } from '../components/TrifectaNightSheetScreen'
import { NIGHTMARE_MARK_ART } from './nightmareMarkPaths'
import star from '../assets/nightmare/symbols/star.png'
import scream from '../assets/nightmare/symbols/scream.png'
import hand from '../assets/nightmare/symbols/hand.png'
import demon from '../assets/nightmare/symbols/demon.png'
import nightmareScene from '../assets/nightmare/nightmare-scene.png'

/** Icon key -> image src. Which icon sits in which grid cell is real game
 * config (worker/src/families/nightmareData.ts's NIGHTMARE_ARRANGEMENT,
 * broadcast on ChannelSnapshot.sheetConfig), so this file is just art.
 *
 * The scene here was extracted from the marks SVG's own embedded copy --
 * this bundle had no standalone scene export, and the embedded one is the
 * same art at the same resolution every other Sheet's export ships. */
const NIGHTMARE_ICON_SRC: Record<NightmareIcon, string> = {
  star,
  scream,
  hand,
  demon,
}

/** Nightmare's own art bundle for the shared TrifectaNightSheetScreen --
 * see that component's own doc comment for what each field is for. Label
 * position is a placeholder pending real visual feedback, same as every
 * other Sheet's own first pass. */
export const NIGHTMARE_SHEET_ART: TrifectaSheetArt<NightmareIcon> = {
  sceneImage: nightmareScene,
  iconSrc: NIGHTMARE_ICON_SRC,
  markArt: NIGHTMARE_MARK_ART,
  labelLeft: '5%',
  labelTop: '2%',
}
