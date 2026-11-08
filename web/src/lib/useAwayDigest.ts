import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChannelSnapshot, Digest, DigestPoint, SeasonSummary } from '@total-tossup-live/shared'
import { digestBetween } from '@total-tossup-live/shared'
import { CHANNEL_ID, RECENT_URL } from './config'

const STORAGE_KEY = `ttl.lastSeen.${CHANNEL_ID}`
/** How often the watching position is written down. Snapshots arrive every
 * couple of seconds and none of them is worth a disk write; all that
 * matters is that the stored point is close enough to when watching
 * actually stopped. */
const SAVE_EVERY_MS = 15_000

/**
 * The viewer's own absence, and what happened during it.
 *
 * Keyed per channel and kept entirely on the device, the same call as the
 * colour scheme: how long *you* were away isn't something everyone
 * watching the same channel needs to agree on, and there's nowhere to put
 * it server-side until accounts exist. localStorage also means a digest
 * costs the coordinator nothing — no new endpoint, no new state, no extra
 * bytes on a broadcast.
 *
 * Two ways back into the app, and both have to work:
 *
 *  - A fresh load. The stored point is whatever was last written before
 *    the tab went away, and the absence runs from there.
 *  - A tab coming back to the foreground, which on web is the common one
 *    and never unmounts anything. Writing the position stops the moment
 *    the tab is hidden, so the stored point stays frozen at the start of
 *    the absence rather than creeping forward while nobody is looking.
 *
 * The digest is computed once per return and then held, not recomputed as
 * snapshots arrive — it describes a moment, and a card that quietly
 * rewrote itself while being read would be worse than no card.
 */
export function useAwayDigest(snapshot: ChannelSnapshot | null) {
  const [digest, setDigest] = useState<Digest | null>(null)
  const latest = useRef<ChannelSnapshot | null>(null)
  const savedAt = useRef(0)
  /** The point an absence is measured from. Held here as well as in
   * storage so a tab returning to the foreground doesn't have to trust
   * that the last write landed before it was hidden. */
  const lastSeen = useRef<DigestPoint | null>(readStored())
  const checked = useRef(false)

  const pointFor = (from: ChannelSnapshot): DigestPoint => ({ ...from, seenAt: Date.now() })

  const remember = useCallback((from: ChannelSnapshot) => {
    const point = pointFor(from)
    lastSeen.current = point
    savedAt.current = Date.now()
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(point))
    } catch {
      // Private browsing, or storage full. A digest is a nicety; losing it
      // should never take the live view down with it.
    }
  }, [])

  const catchUp = useCallback(() => {
    const now = latest.current
    const then = lastSeen.current
    if (!now) return
    const point = pointFor(now)
    remember(now)
    if (!then) return

    // No Season boundary crossed means nothing has settled, so there is
    // nothing history could add — the live snapshot still holds this
    // Season's whole Week order. The common return to the app takes this
    // path and makes no request at all.
    if (now.seasonNumber === then.seasonNumber) {
      setDigest(digestBetween(then, point))
      return
    }

    // A boundary was crossed, so the Seasons in between are gone from the
    // snapshot and only /recent remembers them. Awaited rather than
    // patched in afterwards: a card that appeared and then rewrote itself
    // as the fetch landed would be worse than a card that appeared a beat
    // later, for the same reason the digest isn't recomputed as snapshots
    // arrive. On failure the request contributes nothing and the digest is
    // exactly the one the diff alone would have produced.
    void recentSeasons(then.lifetimeRecord.humans + then.lifetimeRecord.demons).then((seasons) =>
      setDigest(digestBetween(then, point, seasons)),
    )
  }, [remember])

  useEffect(() => {
    if (!snapshot) return
    latest.current = snapshot

    // The first snapshot after a load is the one the absence is measured
    // against. Later ones only move the watching position along.
    if (!checked.current) {
      checked.current = true
      catchUp()
      return
    }

    if (document.visibilityState === 'visible' && Date.now() - savedAt.current >= SAVE_EVERY_MS) {
      remember(snapshot)
    }
  }, [snapshot, catchUp, remember])

  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        // Freeze the position here, so the absence is measured from the
        // moment watching stopped rather than from the last periodic save.
        if (latest.current) remember(latest.current)
        return
      }
      catchUp()
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [catchUp, remember])

  const dismiss = useCallback(() => setDigest(null), [])

  return { digest, dismiss }
}

/** The Seasons that settled after `since`, or [] if they can't be had.
 * Every caller treats an empty answer as "no extra detail" rather than as
 * an error, so a coordinator that hasn't been deployed with the route yet
 * degrades to the plain diff instead of breaking the card. */
async function recentSeasons(since: number): Promise<SeasonSummary[]> {
  try {
    const response = await fetch(`${RECENT_URL}?since=${since}`)
    if (!response.ok) return []
    const body = (await response.json()) as { seasons?: SeasonSummary[] }
    return body.seasons ?? []
  } catch {
    return []
  }
}

function readStored(): DigestPoint | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DigestPoint
    // Anything written by an older shape, or a hand-edited value, should
    // mean "no digest" rather than a crash on the first render.
    return typeof parsed?.seenAt === 'number' && parsed.lifetimeRecord ? parsed : null
  } catch {
    return null
  }
}
