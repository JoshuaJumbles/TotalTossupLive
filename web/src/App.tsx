import { AnimatePresence, motion } from 'framer-motion'
import type { ChannelSnapshot } from '@total-tossup-live/shared'
import { screenForPhase } from '@total-tossup-live/shared'
import { useChannelSnapshot } from './lib/useChannelSnapshot'
import { usePhaseProgress } from './lib/usePhaseProgress'
import { NightSheetScreen } from './components/NightSheetScreen'
import { SeasonLaunchScreen } from './components/SeasonLaunchScreen'
import { SeasonOverviewScreen } from './components/SeasonOverviewScreen'
import { SeasonFinishScreen } from './components/SeasonFinishScreen'

function App() {
  const { snapshot, connected } = useChannelSnapshot()
  const progress = usePhaseProgress(snapshot?.phaseStartedAt ?? 0, snapshot?.phaseEndsAt ?? 0)

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-neutral-950 p-6 text-neutral-100">
      <header className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Total Tossup Live</h1>
        <p className="text-xs text-neutral-500">{connected ? 'live' : 'reconnecting…'}</p>
      </header>

      {!snapshot ? (
        <p className="text-neutral-400">{connected ? 'loading…' : 'connecting…'}</p>
      ) : (
        <ScreenSwitcher snapshot={snapshot} progress={progress} />
      )}
    </div>
  )
}

// Keyed by *screen*, not phase — flipping/round_resolved/night_won/week_won
// all map to 'night_sheet' (see shared/src/screen.ts) and re-render in place
// with no crossfade, so the within-week gameplay loop stays continuous.
// Only crossing a screen boundary (e.g. into Season Overview) triggers this
// transition.
function ScreenSwitcher({ snapshot, progress }: { snapshot: ChannelSnapshot; progress: number }) {
  const screen = screenForPhase(snapshot.phase)

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={screen}
        className="flex w-full flex-col items-center gap-8"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.3 }}
      >
        {screen === 'season_launch' && <SeasonLaunchScreen snapshot={snapshot} progress={progress} />}
        {screen === 'season_overview' && <SeasonOverviewScreen snapshot={snapshot} progress={progress} />}
        {screen === 'season_finish' && <SeasonFinishScreen snapshot={snapshot} progress={progress} />}
        {screen === 'night_sheet' && <NightSheetScreen snapshot={snapshot} progress={progress} />}
      </motion.div>
    </AnimatePresence>
  )
}

export default App
