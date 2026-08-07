import type { ReactNode } from 'react'
import type { ContainerScore, Side } from '@total-tossup-live/shared'
import { containerWinner } from '@total-tossup-live/shared'
import { TeamPortrait } from './TeamPortrait'

interface MatchupHeaderProps {
  lifetimeRecord: ContainerScore
  showLifetimeWinCount?: boolean
  showPortraits?: boolean
  portraitClassName?: string
  /** VS. on Season Launch, the big score on Season Overview/Finish. */
  center?: ReactNode
}

/**
 * The HUMANS/DEMONS matchup block reused across all three non-gameplay
 * screens: portraits (with a crown on whichever side leads the lifetime
 * record), Champion/Challenger labels, optional win counts, and a center
 * slot. The Figma source lays these out with the center content
 * overlapping the team-name row at absolute coordinates; a rough sketch
 * per its own description, not an intentional overlap — this uses a plain
 * three-column flex layout instead, which keeps the same visual intent
 * (team info flanking a center element) without fragile positioning.
 */
export function MatchupHeader({
  lifetimeRecord,
  showLifetimeWinCount = true,
  showPortraits = true,
  portraitClassName = 'w-32 sm:w-40',
  center,
}: MatchupHeaderProps) {
  const champion = containerWinner(lifetimeRecord)

  return (
    <div className="flex w-full items-center justify-center gap-4 sm:gap-8">
      <TeamBlock
        side="humans"
        isChampion={champion === 'humans'}
        count={lifetimeRecord.humans}
        showCount={showLifetimeWinCount}
        showPortrait={showPortraits}
        portraitClassName={portraitClassName}
      />
      {center && <div className="flex flex-col items-center">{center}</div>}
      <TeamBlock
        side="demons"
        isChampion={champion === 'demons'}
        count={lifetimeRecord.demons}
        showCount={showLifetimeWinCount}
        showPortrait={showPortraits}
        portraitClassName={portraitClassName}
      />
    </div>
  )
}

function TeamBlock({
  side,
  isChampion,
  count,
  showCount,
  showPortrait,
  portraitClassName,
}: {
  side: Side
  isChampion: boolean
  count: number
  showCount: boolean
  showPortrait: boolean
  portraitClassName: string
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      {showPortrait && <TeamPortrait side={side} isChampion={isChampion} className={portraitClassName} />}
      <p className="font-display text-2xl uppercase text-fg sm:text-3xl">{side}</p>
      {/* Tied (including a fresh 0-0 channel) — neither side claims Champion. */}
      <p className="font-body text-lg text-fg sm:text-xl">{isChampion ? 'Champion' : 'Challenger'}</p>
      {showCount && (
        <p className="font-body text-sm text-fg">
          {count} Season {count === 1 ? 'Win' : 'Wins'}
        </p>
      )}
    </div>
  )
}
