interface StatusLabelProps {
  connected: boolean
}

/**
 * TitleHeaderFrame's StatusLabel in Figma — connection status only now.
 * The channel name used to live here too ("Channel: Battle
 * (reconnecting)"), but that risked wrapping onto a second line in this
 * sub-line's narrow width for a longer channel name — which pushed
 * AppHeader taller than its fixed height and squeezed the Night Sheet
 * below it (the bug Josh flagged). The channel name moved into Wordmark's
 * own full-width title line instead (see Wordmark.tsx); this renders
 * nothing at all once connected, same as before.
 */
export function StatusLabel({ connected }: StatusLabelProps) {
  if (connected) return null

  return <p className="w-full truncate whitespace-nowrap text-center font-body text-base text-fg">reconnecting</p>
}
