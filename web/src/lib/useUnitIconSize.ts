import { useLayoutEffect, useRef, useState } from 'react'
import { columnCounts, OVERLAP, STAGGER } from './unitLayout'

/** Measures the ref'd element (the SheetFrame region) and derives the
 * icon size that lets columnCounts(total) columns — overlapping and
 * staggered per unitLayout's constants, two sides side by side — fill
 * whatever height and width that region actually has. This is the literal
 * "scale to fit the vertical space container" mechanism: recomputes on
 * resize (ResizeObserver) and whenever `total` changes (a new Night's
 * unit count), so it holds up at any viewport size or future frame resize
 * without touching this code. Reads the actual column-gap CSS value
 * (`gap-8 sm:gap-16` on the SheetFrame) rather than hardcoding it, so a
 * breakpoint change doesn't need a matching edit here. */
export function useUnitIconSize(total: number) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState(0)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    const counts = columnCounts(total)
    const numColumns = counts.length
    const maxRows = Math.max(...counts)
    // Total column height = size + (maxRows-1) overlapping rows, plus the
    // innermost column's stagger lift eating into the same vertical budget.
    const heightDenom = 1 + (maxRows - 1) * (1 - OVERLAP) + (numColumns - 1) * STAGGER

    const measure = () => {
      const gapPx = parseFloat(getComputedStyle(el).columnGap || '0')
      const widthPerSide = (el.clientWidth - gapPx) / 2
      const sizeFromWidth = widthPerSide / numColumns
      const sizeFromHeight = el.clientHeight / heightDenom
      const next = Math.floor(Math.min(sizeFromWidth, sizeFromHeight))
      if (next > 0) setSize(Math.max(20, next))
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [total])

  return { ref, size }
}
