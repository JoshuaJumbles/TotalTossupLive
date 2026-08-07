import { motion } from 'framer-motion';
import type { ChannelSnapshot, ContainerScore } from '@total-tossup-live/shared';

interface ScoreBoardProps {
  snapshot: ChannelSnapshot;
}

export function ScoreBoard({ snapshot }: ScoreBoardProps) {
  return (
    <div className="flex w-full max-w-md flex-col gap-4">
      <ScoreRow label={`Week ${snapshot.weekNumber}`} score={snapshot.weekScore} />
      <ScoreRow label={`Season ${snapshot.seasonNumber}`} score={snapshot.seasonScore} />
      <ScoreRow label="All-time seasons won" score={snapshot.lifetimeRecord} />
    </div>
  );
}

function ScoreRow({ label, score }: { label: string; score: ContainerScore }) {
  const total = score.humans + score.demons || 1;
  const humansPct = (score.humans / total) * 100;
  const demonsPct = (score.demons / total) * 100;

  return (
    <div>
      <div className="mb-1 flex justify-between text-sm text-neutral-400">
        <span>{label}</span>
        <span className="tabular-nums">
          <span className="text-sky-400">{score.humans}</span>
          {' – '}
          <span className="text-rose-400">{score.demons}</span>
        </span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-neutral-800">
        <motion.div className="h-full bg-sky-400" animate={{ width: `${humansPct}%` }} transition={{ duration: 0.5 }} />
        <motion.div className="h-full bg-rose-400" animate={{ width: `${demonsPct}%` }} transition={{ duration: 0.5 }} />
      </div>
    </div>
  );
}
