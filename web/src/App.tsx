import { AnimatePresence, motion } from 'framer-motion'
import type { ChannelSnapshot } from '@total-tossup-live/shared'
import { screenForPhase } from '@total-tossup-live/shared'
import { useChannelSnapshot } from './lib/useChannelSnapshot'
import { usePhaseProgress } from './lib/usePhaseProgress'
import { useColorScheme } from './lib/useColorScheme'
import { AppHeader } from './components/AppHeader'
import { NightSheetScreen } from './components/NightSheetScreen'
import { SeasonLaunchScreen } from './components/SeasonLaunchScreen'
import { SeasonOverviewScreen } from './components/SeasonOverviewScreen'
import { SeasonFinishScreen } from './components/SeasonFinishScreen'
import { StandbyScreen } from './components/StandbyScreen'

function App() {
  const { snapshot, connected } = useChannelSnapshot()
  const progress = usePhaseProgress(snapshot?.phaseStartedAt ?? 0, snapshot?.phaseEndsAt ?? 0)
  const { cycleColorScheme } = useColorScheme()

  return (
    // h-dvh (not min-h-screen) so the body below the header gets a real,
    // stable height to stretch into on mobile Safari — a static 100vh
    // doesn't account for the address bar collapsing/expanding, which
    // Night Sheet's proportional Sheet/Coin/Score split depends on.
    <div className="flex h-dvh w-full flex-col items-center bg-bg text-fg">
      <AppHeader connected={connected} onCycleColorScheme={cycleColorScheme} />

      {/* No padding here — Battle's SheetFrame/CoinFrame/ScoreFrame are
       * meant to run edge-to-edge (Figma's NightScreen_iPhone), same as
       * AppHeader above. Every other screen adds its own px-6 pb-6 instead
       * of it being forced on the one screen that doesn't want it. */}
      <div className="flex w-full max-w-md flex-1 flex-col items-center overflow-hidden">
        {!snapshot ? (
          <p className="m-auto font-body text-fg">{connected ? 'loading…' : 'connecting…'}</p>
        ) : (
          <ScreenSwitcher snapshot={snapshot} progress={progress} />
        )}
      </div>
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
        className="flex w-full flex-1 min-h-0 flex-col items-center gap-8"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.3 }}
      >
        {screen === 'standby' && <StandbyScreen snapshot={snapshot} />}
        {screen === 'season_launch' && <SeasonLaunchScreen snapshot={snapshot} progress={progress} />}
        {screen === 'season_overview' && <SeasonOverviewScreen snapshot={snapshot} progress={progress} />}
        {screen === 'season_finish' && <SeasonFinishScreen snapshot={snapshot} progress={progress} />}
        {screen === 'night_sheet' && <NightSheetScreen snapshot={snapshot} progress={progress} />}
      </motion.div>
    </AnimatePresence>
  )
}

export default App
