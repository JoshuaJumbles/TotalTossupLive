import { Wordmark } from './Wordmark'
import { StatusLabel } from './StatusLabel'
import { CHANNEL_ID } from '../lib/config'

interface AppHeaderProps {
  connected: boolean
}

/** Universal top bar, shown identically on every screen — matches Figma's
 * TitleHeaderFrame: a bordered bg-card box housing the wordmark plus
 * StatusLabel underneath (folding in what used to be a separate dev-only
 * badge above the header — see StatusLabel for that logic). Full border-2
 * box per TitleHeaderFrame's own spec, not the rest of the app's border-4
 * top/bottom-only convention. */
export function AppHeader({ connected }: AppHeaderProps) {
  return (
    <div className="flex w-full max-w-md shrink-0 flex-col items-center gap-1 border-2 border-fg bg-card px-4 py-3">
      <Wordmark />
      <StatusLabel channelId={CHANNEL_ID} connected={connected} />
    </div>
  )
}
