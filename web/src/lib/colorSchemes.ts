/** One named bundle of the tokens index.css's own @theme block defines —
 * "the palette seam: everything downstream reads these tokens... so a
 * future palette switcher is just swapping the values below" (its own doc
 * comment, written before this existed). A scheme is exactly that swap,
 * made real. humans/demons still exist for surfaces that want one flat
 * side color (TensionBar, SeasonIndicatorFrame, the header toggle swatch,
 * RoundTracker); humansLine/humansFill and demonsLine/demonsFill are the
 * finer-grained pair TeamArt reads for the character art specifically. */
export interface ColorScheme {
  name: string
  bg: string
  fg: string
  humans: string
  humansLine: string
  humansFill: string
  demons: string
  demonsLine: string
  demonsFill: string
  activity: string
  card: string
}

/** Unit icons (TeamArt) are fully scheme-driven — both the fill and the
 * line layers read their own tokens, same mask-and-tint technique as the
 * coin-flip hand and CrossOutMark. Every token-driven surface in the app
 * (backgrounds, borders, text, the coin/tension bar/season indicator
 * fills, and the character art itself) reads the active scheme
 * correctly. */
export const COLOR_SCHEMES: ColorScheme[] = [
  {
    // Today's values, verbatim — the physical paper-and-ink look.
    name: 'Classic',
    bg: '#ffffff',
    fg: '#000000',
    humans: '#72a3ff',
    humansLine: '#000000',
    humansFill: '#ffffff',
    demons: '#ff5454',
    demonsLine: '#000000',
    demonsFill: '#ffffff',
    activity: '#f5a623',
    card: '#e6e6e6',
  },
  {
    // Dark mode proposal: #121212/#f2f2f2 (Material's own dark-theme
    // convention — true black/white read harsher and flatten depth).
    // humans/demons nudged a touch brighter to hold their contrast
    // against a near-black field instead of just carrying the light-mode
    // values over unchanged; card is a shade lighter than bg so panels
    // (AppHeader, ScoreFrame) still read as a distinct surface, mirroring
    // Classic's card being a shade darker than its own white bg.
    name: 'Midnight',
    bg: '#121212',
    fg: '#f2f2f2',
    humans: '#84aeff',
    humansLine: '#f2f2f2',
    humansFill: '#121212',
    demons: '#ff5c5c',
    demonsLine: '#f2f2f2',
    demonsFill: '#121212',
    activity: '#ffb238',
    card: '#1e1e24',
  },
]
