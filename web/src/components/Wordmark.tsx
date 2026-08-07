/** The big brand lockup — shown on Season Launch/Overview/Finish, matching
 * the Figma source. Deliberately omitted on Night Sheet, which prioritizes
 * screen space for the live gameplay state instead. */
export function Wordmark() {
  return (
    <h1 className="text-center font-display uppercase leading-none text-fg">
      <span className="block text-4xl sm:text-6xl">Total Tossup</span>
      <span className="block text-4xl italic sm:text-6xl">Live</span>
    </h1>
  )
}
