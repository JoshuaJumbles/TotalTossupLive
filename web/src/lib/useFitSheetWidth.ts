import { useLayoutEffect, useRef, useState } from 'react'

/**
 * Measures the ref'd container (SheetArea) and returns the largest width a
 * box of the given aspect ratio (width/height) can have while still fitting
 * entirely inside it -- the "contain" fit, computed directly rather than
 * leaning on CSS aspect-ratio's own flex-sizing quirks (which need an
 * explicit driving dimension to behave predictably in a centered flex
 * container). Same ResizeObserver-driven measure-on-resize pattern as
 * useUnitIconSize -- ...recomputes on any resize, so it holds up at any
 * viewport size or browser-chrome change without touching this code.
 *
 * This is the fix for the Sheet content getting pillarboxed: previously a
 * fixed-aspect scene image sat inside a proportional flex-basis box whose
 * own aspect ratio didn't match the image's, so object-contain padded it
 * narrower than its container. Sizing the box itself to the content's real
 * aspect ratio (via this hook) means there's no mismatch to pad away --
 * and everything positioned as a percentage of that box (BarricadeBars'
 * marks, the "Night N" label) resolves correctly with no further changes.
 */
export function useFitSheetWidth(aspectRatio: number) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    const measure = () => {
      const widthFromHeight = el.clientHeight * aspectRatio
      const next = Math.floor(Math.min(el.clientWidth, widthFromHeight))
      if (next > 0) setWidth(next)
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [aspectRatio])

  return { ref, width }
}
