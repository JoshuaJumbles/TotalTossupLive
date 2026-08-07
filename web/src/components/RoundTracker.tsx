import type { BestOfNightState, BestOfSheetConfig } from '@total-tossup-live/shared';

interface RoundTrackerProps {
  nightState: BestOfNightState;
  sheetConfig: BestOfSheetConfig;
}

export function RoundTracker({ nightState, sheetConfig }: RoundTrackerProps) {
  return (
    <div className="flex flex-col items-center gap-1 text-sm text-neutral-400">
      <p>
        Night — race to {sheetConfig.targetRoundPoints}:{' '}
        <span className="tabular-nums">
          <span className="text-sky-400">{nightState.roundPoints.humans}</span>
          {' – '}
          <span className="text-rose-400">{nightState.roundPoints.demons}</span>
        </span>
      </p>
      <p>
        This round — best of {sheetConfig.roundSize}:{' '}
        <span className="tabular-nums">
          <span className="text-sky-400">{nightState.currentRound.flipWins.humans}</span>
          {' – '}
          <span className="text-rose-400">{nightState.currentRound.flipWins.demons}</span>
        </span>
      </p>
    </div>
  );
}
