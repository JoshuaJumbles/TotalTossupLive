import type { BarricadeIcon } from '@total-tossup-live/shared'
import knife from '../assets/barricade/symbols/knife.png'
import medkit from '../assets/barricade/symbols/medkit.png'
import planks from '../assets/barricade/symbols/planks.png'

/**
 * Icon key -> image src. Just the art -- which icon actually sits on each
 * grid pair's O/X side is real game config now (worker/src/families/
 * barricadeData.ts's BARRICADE_ARRANGEMENT), broadcast to every viewer as
 * part of ChannelSnapshot.sheetConfig, so this file no longer keeps its
 * own separate copy of that arrangement.
 */
export const BARRICADE_ICON_SRC: Record<BarricadeIcon, string> = {
  knife,
  medkit,
  planks,
}
