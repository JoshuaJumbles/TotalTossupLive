import { capitalize } from '../lib/text'

interface WordmarkProps {
  channelId: string
}

/** "Total" on the main channel; every other channel gets its own name
 * mashed into the same lockup ("Battle Tossup Live", "Teamwork Tossup
 * Live", etc.) -- Josh's own idea for keeping the channel identity in the
 * one line that has real room for it (AppHeader's full-width title),
 * rather than squeezed into StatusLabel's much narrower sub-line where a
 * longer channel name risked wrapping and pushing the header taller than
 * its fixed height (see AppHeader's own note). */
function channelWord(channelId: string): string {
  return channelId === 'main' ? 'Total' : capitalize(channelId)
}

/** The brand lockup itself — sized for its one caller, AppHeader's slim
 * persistent top bar (see TitleHeaderFrame in Figma). One line, matching
 * TitleHeaderFrame's own single-line "TOTAL TOSSUP LIVE" — the old
 * stacked two-line layout predates that spec. whitespace-nowrap +
 * truncate: AppHeader's fixed height depends on this never wrapping, even
 * for a channel name longer than any that exist today. */
export function Wordmark({ channelId }: WordmarkProps) {
  return (
    <h1 className="w-full truncate whitespace-nowrap text-center font-display uppercase leading-none text-fg">
      <span className="text-xl sm:text-2xl">{channelWord(channelId)} Tossup </span>
      <span className="text-xl italic sm:text-2xl">Live</span>
    </h1>
  )
}
