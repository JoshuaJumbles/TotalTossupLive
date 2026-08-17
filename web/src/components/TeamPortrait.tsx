import type { Side } from '@total-tossup-live/shared'
import crownArt from '../assets/crown.png'
import { TeamArt } from './TeamArt'

interface TeamPortraitProps {
  side: Side
  /** Shows the crown above the portrait — derived from
   * containerWinner(lifetimeRecord), null (tied/fresh) means neither side
   * gets one. */
  isChampion: boolean
  className?: string
}

export function TeamPortrait({ side, isChampion, className = 'w-40' }: TeamPortraitProps) {
  return (
    <div className={`relative ${className}`}>
      {isChampion && (
        <img
          src={crownArt}
          alt="Champion"
          className="absolute left-1/2 top-[-18%] w-[45%] -translate-x-1/2"
        />
      )}
      {/* Demon art is mirrored so both sides face each other across the
       * VS., matching the Figma source. */}
      <TeamArt side={side} className={side === 'demons' ? 'scale-x-[-1]' : ''} />
    </div>
  )
}
