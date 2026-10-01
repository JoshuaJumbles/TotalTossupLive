import type { BombSquadIcon } from '@total-tossup-live/shared'
import type { TrifectaSheetArt } from '../components/TrifectaNightSheetScreen'
import { BOMBSQUAD_MARK_ART } from './bombSquadMarkPaths'
import bomb from '../assets/bombsquad/symbols/bomb.png'
import small from '../assets/bombsquad/symbols/small.png'
import medium from '../assets/bombsquad/symbols/medium.png'
import large from '../assets/bombsquad/symbols/large.png'
import bombSquadScene from '../assets/bombsquad/bombsquad-scene.png'

/** Icon key -> image src. Which icon sits in which grid cell is real game
 * config (worker/src/families/bombSquadData.ts's BOMBSQUAD_ARRANGEMENT,
 * broadcast on ChannelSnapshot.sheetConfig), so this file is just art.
 * Note `small` is a single icon showing a cluster of four creatures,
 * the same way Ambush's `guns` shows a pair of pistols. */
const BOMBSQUAD_ICON_SRC: Record<BombSquadIcon, string> = {
  bomb,
  small,
  medium,
  large,
}

/** Bomb Squad's own art bundle for the shared TrifectaNightSheetScreen --
 * see that component's own doc comment for what each field is for. Label
 * position is a placeholder pending real visual feedback, same as every
 * other Sheet's own first pass. */
export const BOMBSQUAD_SHEET_ART: TrifectaSheetArt<BombSquadIcon> = {
  sceneImage: bombSquadScene,
  iconSrc: BOMBSQUAD_ICON_SRC,
  markArt: BOMBSQUAD_MARK_ART,
  labelLeft: '5%',
  labelTop: '2%',
}
