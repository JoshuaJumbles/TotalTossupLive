import { Wordmark } from './Wordmark'

/** Universal top bar, shown identically on every screen — matches
 * NightScreen_iPhone's TitleFrame in Figma (a bordered bg-card box housing
 * the wordmark). Replaces the old pattern of each of Season Launch/
 * Overview/Finish rendering its own big Wordmark hero while Night Sheet
 * omitted it entirely; one consistent header everywhere is simpler and is
 * what makes the wordmark visible on the Battle Sheet view too. */
export function AppHeader() {
  return (
    <div className="flex w-full max-w-md shrink-0 items-center justify-center border-b-4 border-fg bg-card py-3">
      <Wordmark />
    </div>
  )
}
