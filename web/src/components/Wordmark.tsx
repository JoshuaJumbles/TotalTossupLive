/** The brand lockup itself — sized for its one caller, AppHeader's slim
 * persistent top bar (see NightScreen_iPhone's TitleFrame in Figma). Used
 * to be the big hero on Season Launch/Overview/Finish only, omitted on
 * Night Sheet; now every screen gets the same compact universal header
 * instead, so this only needs the one size. */
export function Wordmark() {
  return (
    <h1 className="text-center font-display uppercase leading-none text-fg">
      <span className="block text-xl sm:text-2xl">Total Tossup</span>
      <span className="block text-xl italic sm:text-2xl">Live</span>
    </h1>
  )
}
