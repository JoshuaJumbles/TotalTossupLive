function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

interface StatusLabelProps {
  channelId: string
  connected: boolean
}

/**
 * TitleHeaderFrame's StatusLabel in Figma — replaces the old separate
 * dev-only "live" / "channel: X" badge that used to sit above AppHeader
 * with one line folded into the header itself.
 *
 * 'live' is the assumed default (the app is called Total Tossup LIVE, so
 * saying it again is redundant) — a non-live status is the only thing
 * worth surfacing (today just 'reconnecting', room for more later), and
 * when there is one it's attached onto the channel name: "Channel: Battle
 * (reconnecting)", Figma's own example text. On the main channel there's
 * no channel name worth naming, so a non-live status stands alone instead
 * of being parenthesized onto nothing. Renders nothing at all once both
 * are absent (main channel, connected).
 */
export function StatusLabel({ channelId, connected }: StatusLabelProps) {
  const channelPart = channelId === 'main' ? null : `Channel: ${capitalize(channelId)}`
  const statusPart = connected ? null : 'reconnecting'

  if (!channelPart && !statusPart) return null

  const label = channelPart && statusPart ? `${channelPart} (${statusPart})` : (channelPart ?? capitalize(statusPart!))

  return <p className="text-center font-body text-base text-fg">{label}</p>
}
