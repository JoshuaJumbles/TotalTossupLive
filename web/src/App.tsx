import { motion } from 'framer-motion'
import { PHASE_DURATIONS_MS } from '@total-tossup-live/shared'

// Placeholder screen — proves the workspace wiring (Tailwind, Framer Motion,
// and the @total-tossup-live/shared types) all work end to end. Replaced by
// the real live-channel view once the WebSocket/snapshot client exists.
function App() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-neutral-950 text-neutral-100">
      <motion.h1
        className="text-3xl font-semibold tracking-tight"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        Total Tossup Live
      </motion.h1>
      <p className="text-sm text-neutral-400">
        flip phase duration: {PHASE_DURATIONS_MS.flipping}ms — scaffold OK
      </p>
    </div>
  )
}

export default App
