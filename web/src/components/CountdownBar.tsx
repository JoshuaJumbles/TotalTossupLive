import { motion } from 'framer-motion'

interface CountdownBarProps {
  /** 0..1, from usePhaseProgress — the bar drains as the phase runs out. */
  progress: number
  className?: string
  barClassName?: string
}

export function CountdownBar({
  progress,
  className = 'h-1.5 w-full overflow-hidden rounded-full bg-card',
  barClassName = 'h-full bg-activity',
}: CountdownBarProps) {
  return (
    <div className={className}>
      <motion.div
        className={barClassName}
        animate={{ width: `${(1 - progress) * 100}%` }}
        transition={{ duration: 0.1, ease: 'linear' }}
      />
    </div>
  )
}
