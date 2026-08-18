import { useEffect, useState } from 'react'
import { COLOR_SCHEMES, type ColorScheme } from './colorSchemes'

const STORAGE_KEY = 'color-scheme'

function applyScheme(scheme: ColorScheme) {
  const root = document.documentElement.style
  root.setProperty('--color-bg', scheme.bg)
  root.setProperty('--color-fg', scheme.fg)
  root.setProperty('--color-humans', scheme.humans)
  root.setProperty('--color-humans-line', scheme.humansLine)
  root.setProperty('--color-humans-fill', scheme.humansFill)
  root.setProperty('--color-demons', scheme.demons)
  root.setProperty('--color-demons-line', scheme.demonsLine)
  root.setProperty('--color-demons-fill', scheme.demonsFill)
  root.setProperty('--color-activity', scheme.activity)
  root.setProperty('--color-card', scheme.card)
}

function loadSavedIndex(): number {
  const saved = localStorage.getItem(STORAGE_KEY)
  const i = COLOR_SCHEMES.findIndex((s) => s.name === saved)
  return i >= 0 ? i : 0
}

/**
 * A personal viewer preference, not part of the broadcast — Josh's own
 * call: like light/dark mode, it's about the viewer's own context, not
 * something everyone watching the same channel needs to agree on. Plain
 * localStorage, no ChannelSnapshot field, no worker involvement at all.
 *
 * Applies via direct CSS custom property overrides on the root element
 * rather than a data-attribute + CSS block per scheme: Tailwind v4's own
 * utilities already compile to `background-color: var(--color-humans)`
 * (confirmed against the real build output, not assumed) — a real
 * variable reference, not an inlined hex — so an inline override on
 * :root's own style cascades through every bg-/text-/border- utility
 * across the whole app with nothing else to wire up. New schemes are just
 * new entries in colorSchemes.ts, no CSS to hand-write per scheme.
 *
 * Known rough edge, not fixed here: a saved non-Classic scheme applies
 * after first paint (useEffect runs post-mount), so there's a brief flash
 * of Classic before it switches. Fixable later with a small inline
 * script in index.html that applies the saved scheme before React mounts
 * — skipped for this first pass to keep the change small.
 */
export function useColorScheme() {
  const [index, setIndex] = useState(loadSavedIndex)

  useEffect(() => {
    const scheme = COLOR_SCHEMES[index]
    applyScheme(scheme)
    localStorage.setItem(STORAGE_KEY, scheme.name)
  }, [index])

  function cycleColorScheme() {
    setIndex((i) => (i + 1) % COLOR_SCHEMES.length)
  }

  return { scheme: COLOR_SCHEMES[index], cycleColorScheme }
}
