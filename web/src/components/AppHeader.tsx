import { Wordmark } from './Wordmark'
import { StatusLabel } from './StatusLabel'
import { CHANNEL_ID } from '../lib/config'

interface AppHeaderProps {
  connected: boolean
  onCycleColorScheme: () => void
}

/** Universal top bar, shown identically on every screen — matches Figma's
 * TitleHeaderFrame: a bordered bg-card box housing the wordmark plus
 * StatusLabel underneath (folding in what used to be a separate dev-only
 * badge above the header — see StatusLabel for that logic). Full border-2
 * box per TitleHeaderFrame's own spec, not the rest of the app's border-4
 * top/bottom-only convention.
 *
 * Also the one place a color-scheme toggle can live without inventing a
 * navigation concept — it's the only element mounted on every screen
 * regardless of phase. A plain half-humans/half-demons swatch button
 * (first pass: cycles through COLOR_SCHEMES on each tap; a real picker
 * sheet is the natural next step once there are enough named schemes to
 * make picking, rather than cycling, worth it). */
export function AppHeader({ connected, onCycleColorScheme }: AppHeaderProps) {
  return (
    <div className="relative flex w-full max-w-md shrink-0 flex-col items-center gap-1 border-2 border-fg bg-card px-4 py-3">
      <button
        type="button"
        onClick={onCycleColorScheme}
        aria-label="Change color scheme"
        className="absolute right-3 top-3 flex h-6 w-6 overflow-hidden rounded-full border-2 border-fg"
      >
        <span className="h-full w-1/2 bg-humans" />
        <span className="h-full w-1/2 bg-demons" />
      </button>
      <Wordmark />
      <StatusLabel channelId={CHANNEL_ID} connected={connected} />
    </div>
  )
}
