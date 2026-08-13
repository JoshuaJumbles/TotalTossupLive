/** The brand lockup itself — sized for its one caller, AppHeader's slim
 * persistent top bar (see TitleHeaderFrame in Figma). One line, matching
 * TitleHeaderFrame's own single-line "TOTAL TOSSUP LIVE" — the old
 * stacked two-line layout predates that spec. */
export function Wordmark() {
  return (
    <h1 className="whitespace-nowrap text-center font-display uppercase leading-none text-fg">
      <span className="text-xl sm:text-2xl">Total Tossup </span>
      <span className="text-xl italic sm:text-2xl">Live</span>
    </h1>
  )
}
