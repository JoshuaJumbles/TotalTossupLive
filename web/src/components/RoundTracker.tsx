import type { BestOfNightState, BestOfSheetConfig } from '@total-tossup-live/shared'

interface RoundTrackerProps {
  nightState: BestOfNightState
  sheetConfig: BestOfSheetConfig
}

export function RoundTracker({ nightState, sheetConfig }: RoundTrackerProps) {
  return (
    <div className="flex flex-col items-center gap-1 font-body text-sm text-fg">
      <p>
        Night — race to {sheetConfig.targetRoundPoints}:{' '}
        <span className="tabular-nums">
          <span className="text-humans">{nightState.roundPoints.humans}</span>
          {' – '}
          <span className="text-demons">{nightState.roundPoints.demons}</span>
        </span>
      </p>
      <p>
        This round — best of {sheetConfig.roundSize}:{' '}
        <span className="tabular-nums">
          <span className="text-humans">{nightState.currentRound.flipWins.humans}</span>
          {' – '}
          <span className="text-demons">{nightState.currentRound.flipWins.demons}</span>
        </span>
      </p>
    </div>
  )
}
