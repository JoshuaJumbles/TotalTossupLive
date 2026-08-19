import type { CloudFightIcon } from '@total-tossup-live/shared'
import jetpack from '../assets/cloudfight/symbols/jetpack.png'
import bow from '../assets/cloudfight/symbols/bow.png'
import snake from '../assets/cloudfight/symbols/snake.png'
import skull from '../assets/cloudfight/symbols/skull.png'

/** Icon key -> image src, same role as barricadeSymbols.ts's
 * BARRICADE_ICON_SRC -- the arrangement itself lives in real game config
 * (worker/src/families/cloudFightData.ts's CLOUDFIGHT_ARRANGEMENT),
 * broadcast to every viewer as part of ChannelSnapshot.sheetConfig, so
 * this file is just the art. */
export const CLOUDFIGHT_ICON_SRC: Record<CloudFightIcon, string> = {
  jetpack,
  bow,
  snake,
  skull,
}
