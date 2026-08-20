import type { PortalIcon } from '@total-tossup-live/shared'
import type { TeamworkBarLayout } from '../components/TeamworkBars'
import type { TeamworkSheetArt } from '../components/TeamworkNightSheetScreen'
import bat from '../assets/portal/symbols/bat.png'
import book from '../assets/portal/symbols/book.png'
import chain from '../assets/portal/symbols/chain.png'
import ladder from '../assets/portal/symbols/ladder.png'
import portalScene from '../assets/portal/portal-scene.png'

/** Icon key -> image src, same role as the other Sheets' own icon src
 * maps -- the arrangement itself lives in real game config
 * (worker/src/families/portalData.ts's PORTAL_ARRANGEMENT), broadcast to
 * every viewer as part of ChannelSnapshot.sheetConfig, so this file is
 * just the art. */
const PORTAL_ICON_SRC: Record<PortalIcon, string> = {
  bat,
  book,
  chain,
  ladder,
}

// Cell centers below are real pixel positions in Figma's own 409x311
// PortalSheet frame (node 262:1608), transcribed from its own
// HumanBookMarks/DemonBatMarks/HumanLadderMarks/DemonChainMarks
// coordinates -- the same split-lane shape as CloudFight's own
// jetpack/bow (bat and chain share the same 9 x-positions on two
// separate rows, one combined score), just on demons' side this time.
// Position "1" (nearest/first) sits at the rightmost x for bat/chain,
// confirmed against the scene's own printed numbers ("8 7 6 5 4 3 2 1"
// reading left-to-right descending); book's own printed numbers
// ("1 2 3 4 5" ascending) put position "1" at its leftmost x instead --
// both confirmed the same way CloudFight's snake/jetpack bars were.
// Ladder's own defense bar has no printed numbers to confirm against at
// this resolution, so its direction is a best-effort transcription
// pending a live look, same as every other Sheet's own defense bar
// before its first live check.
const BAT_CHAIN_X = [132, 115, 100, 85, 69, 54, 38, 21, -1]

const PORTAL_BAR_LAYOUT: TeamworkBarLayout<PortalIcon> = {
  bat: {
    side: 'demons',
    cells: BAT_CHAIN_X.map((leftPx) => ({ leftPx, topPx: 244, sizePx: 31 })),
  },
  chain: {
    side: 'demons',
    cells: BAT_CHAIN_X.map((leftPx) => ({ leftPx, topPx: 275, sizePx: 31 })),
  },
  book: {
    side: 'humans',
    cells: [239, 261, 283, 305, 326, 360].map((leftPx) => ({ leftPx, topPx: 259, sizePx: 42 })),
  },
  ladder: {
    side: 'humans',
    cells: [75, 60, 44, 27, 6].map((leftPx) => ({ leftPx, topPx: 187, sizePx: 29 })),
  },
}

/** Portal's own art bundle for the shared TeamworkNightSheetScreen --
 * see that component's own doc comment for what each field is for. Label
 * position is a placeholder pending real visual feedback, same as every
 * other Sheet's own first pass. */
export const PORTAL_SHEET_ART: TeamworkSheetArt<PortalIcon> = {
  sceneImage: portalScene,
  iconSrc: PORTAL_ICON_SRC,
  barLayout: PORTAL_BAR_LAYOUT,
  labelLeft: '5%',
  labelTop: '2%',
}
