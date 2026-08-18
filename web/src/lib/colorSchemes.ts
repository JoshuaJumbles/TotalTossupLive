/** One named bundle of the six tokens index.css's own @theme block defines
 * — "the palette seam: everything downstream reads these tokens... so a
 * future palette switcher is just swapping the values below" (its own doc
 * comment, written before this existed). A scheme is exactly that swap,
 * made real. */
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

/** First pass: token-only. Unit icons (human-simple/demon-simple.png) are
 * still fixed black line art — not yet reskinned per scheme, same
 * fill/line treatment as the coin-flip hand and CrossOutMark once Josh
 * exports unit art in that shape. Expect Midnight's Battle screen to look
 * a little flat around the units until then; everything token-driven
 * (backgrounds, borders, text, the coin/tension bar/season indicator
 * fills) already reads correctly. */
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
