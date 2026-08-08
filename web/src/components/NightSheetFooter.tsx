import type { ChannelSnapshot, Side } from '@total-tossup-live/shared'
import { containerWinner } from '@total-tossup-live/shared'

/** The HUMANS/DEMONS captions + big week score, shared by every Night
 * Sheet visual regardless of style ('simple' or 'battle') — this part of
 * the layout doesn't change with the Sheet's presentation. */
export function NightSheetFooter({ snapshot }: { snapshot: ChannelSnapshot }) {
  const champion = containerWinner(snapshot.lifetimeRecord)

  return (
    <div className="flex w-full items-center justify-center gap-6 sm:gap-10">
      <TeamCaption side="humans" isChampion={champion === 'humans'} seasonPts={snapshot.seasonScore.humans} />
      <div className="flex flex-col items-center gap-1">
        <p className="font-display text-5xl text-fg sm:text-6xl">
          {snapshot.weekScore.humans} : {snapshot.weekScore.demons}
        </p>
        <p className="font-body text-lg text-fg">Week {snapshot.weekNumber}</p>
      </div>
      <TeamCaption side="demons" isChampion={champion === 'demons'} seasonPts={snapshot.seasonScore.demons} />
    </div>
  )
}

function TeamCaption({ side, isChampion, seasonPts }: { side: Side; isChampion: boolean; seasonPts: number }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <p className="font-display text-xl uppercase text-fg sm:text-2xl">{side}</p>
      <p className="font-body text-sm text-fg">{isChampion ? 'Champion' : 'Challenger'}</p>
      <p className="font-body text-xs font-light text-fg">{seasonPts} Season Pts</p>
    </div>
  )
}
