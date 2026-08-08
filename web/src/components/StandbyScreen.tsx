import { useState } from 'react'
import type { ChannelSnapshot } from '@total-tossup-live/shared'
import { Wordmark } from './Wordmark'
import { START_URL } from '../lib/config'

interface StandbyScreenProps {
  snapshot: ChannelSnapshot
}

/** Shown while a non-autoStart channel (debug/battle) is idle — no alarm
 * is scheduled server-side in this phase, so the channel costs nothing
 * until this button is pressed. The resulting phase change arrives back
 * over the existing WebSocket like any other transition; no need to do
 * anything with the POST response beyond firing it. */
export function StandbyScreen({ snapshot }: StandbyScreenProps) {
  const [starting, setStarting] = useState(false)

  async function handleStart() {
    setStarting(true)
    try {
      await fetch(START_URL, { method: 'POST' })
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-8 text-center">
      <Wordmark />

      <div className="flex flex-col items-center gap-1">
        <p className="font-body text-xs uppercase tracking-widest text-fg">Lifetime seasons won</p>
        <p className="font-display text-4xl text-fg">
          <span className="text-humans">{snapshot.lifetimeRecord.humans}</span>
          {' – '}
          <span className="text-demons">{snapshot.lifetimeRecord.demons}</span>
        </p>
      </div>

      <p className="font-body text-lg text-fg">Season {snapshot.seasonNumber} is ready.</p>

      <button
        type="button"
        onClick={handleStart}
        disabled={starting}
        className="rounded-full border-4 border-fg bg-fg px-8 py-3 font-display text-xl uppercase text-bg transition-opacity disabled:opacity-50"
      >
        {starting ? 'Starting…' : 'Start Season'}
      </button>
    </div>
  )
}
