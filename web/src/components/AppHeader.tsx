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
 * Fixed h-[104px] (TitleHeaderFrame's own spec height) rather than a
 * content-driven height from padding + line count -- App.tsx makes this a
 * shrink-0 sibling of the h-dvh body, so if the header's own height ever
 * grew (e.g. a StatusLabel line wrapping), the body below it would get
 * squeezed by exactly that much, which is what was throwing off Night
 * Sheet's own proportional Sheet/Coin/Score split and misaligning the
 * Barricade marks. Content is centered within the fixed box instead of
 * padding-driven, with both lines forced to never wrap (see Wordmark/
 * StatusLabel's own notes) so nothing can push past the fixed height again.
 *
 * Also the one place a color-scheme toggle can live without inventing a
 * navigation concept — it's the only element mounted on every screen
 * regardless of phase. A plain half-humans/half-demons swatch button
 * (first pass: cycles through COLOR_SCHEMES on each tap; a real picker
 * sheet is the natural next step once there are enough named schemes to
 * make picking, rather than cycling, worth it). */
export function AppHeader({ connected, onCycleColorScheme }: AppHeaderProps) {
  return (
    <div className="relative flex h-[104px] w-full max-w-md shrink-0 flex-col items-center justify-center gap-1 overflow-hidden border-2 border-fg bg-card px-4">
      <button
        type="button"
        onClick={onCycleColorScheme}
        aria-label="Change color scheme"
        className="absolute right-3 top-3 flex h-6 w-6 overflow-hidden rounded-full border-2 border-fg"
      >
        <span className="h-full w-1/2 bg-humans" />
        <span className="h-full w-1/2 bg-demons" />
      </button>
      <Wordmark channelId={CHANNEL_ID} />
      <StatusLabel connected={connected} />
    </div>
  )
}
