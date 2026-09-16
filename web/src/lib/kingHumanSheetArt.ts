import type { KingHumanIcon } from '@total-tossup-live/shared'
import type { TrifectaSheetArt } from '../components/TrifectaNightSheetScreen'
import type { TrifectaMarkLayout } from '../components/TrifectaMarks'
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

/**
 * Where each destroyable target sits on the scene -- real pixel positions
 * in Figma's own 409x315 KingHumanSceneMarkings frame (node 279:2075).
 *
 * Index order matters: each array is aligned with that side's own
 * config.targets array in worker/src/families/kingHumanData.ts, so a
 * destroyed target index looks its box up directly.
 *
 * - `humans` are the TriKing's nine, in tier order: the four Priority0
 *   boxes, then the four Priority1 boxes, then the single Priority2 one
 *   (the torso space holding the human operators -- the final kill rather
 *   than another wound, which is why it's both the largest box and the
 *   last to go).
 * - `demons` are the three forces' nine, grouped: Big Flyer's three claws,
 *   then the three Axe demons, then the three Spitters.
 *
 * Note the Figma names these frames by who does the *marking* rather than
 * who gets marked -- its `HumanMarks` holds the element groups (the marks
 * humans make, on demons) and its `DemonMarks` holds the priority tiers
 * (the marks demons make, on the TriKing). They're swapped back here so
 * each list belongs to the side that actually loses those targets.
 */
const KINGHUMAN_MARKS: TrifectaMarkLayout = {
  humans: [
    // Priority 0 -- limbs, first to go.
    { leftPx: 136, topPx: 221, sizePx: 44 },
    { leftPx: 127, topPx: 140, sizePx: 53 },
    { leftPx: 210, topPx: 137, sizePx: 53 },
    { leftPx: 210, topPx: 223, sizePx: 42 },
    // Priority 1.
    { leftPx: 132, topPx: 254, sizePx: 51 },
    { leftPx: 205, topPx: 256, sizePx: 51 },
    { leftPx: 69, topPx: 133, sizePx: 74 },
    { leftPx: 243, topPx: 112, sizePx: 74 },
    // Priority 2 -- the torso, saved for last.
    { leftPx: 119, topPx: 95, sizePx: 150 },
  ],
  demons: [
    // Big Flyer's three claws.
    { leftPx: 10, topPx: 22, sizePx: 51 },
    { leftPx: 39, topPx: 11, sizePx: 51 },
    { leftPx: 69, topPx: 18, sizePx: 51 },
    // The three Axe demons.
    { leftPx: 42, topPx: 209, sizePx: 77 },
    { leftPx: -9, topPx: 164, sizePx: 90 },
    { leftPx: 308, topPx: 196, sizePx: 90 },
    // The three Spitters.
    { leftPx: 301, topPx: 98, sizePx: 84 },
    { leftPx: 222, topPx: 22, sizePx: 90 },
    { leftPx: 308, topPx: 29, sizePx: 90 },
  ],
}

/** KingHuman's own art bundle for the shared TrifectaNightSheetScreen --
 * see that component's own doc comment for what each field is for. Label
 * position is a placeholder pending real visual feedback, same as every
 * other Sheet's own first pass. */
export const KINGHUMAN_SHEET_ART: TrifectaSheetArt<KingHumanIcon> = {
  sceneImage: kingHumanScene,
  iconSrc: KINGHUMAN_ICON_SRC,
  marks: KINGHUMAN_MARKS,
  labelLeft: '5%',
  labelTop: '2%',
}
