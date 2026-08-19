import type { ReactNode } from 'react'
import sheetAreaBackdrop from '../assets/sheet-area/sheet-area-backdrop.png'

interface SheetAreaProps {
  children: ReactNode
}

/**
 * The flexible region between AppHeader/CoinFrame/ScoreFrame's fixed
 * heights -- absorbs whatever vertical space real browser chrome (Safari's
 * toolbar, in particular) actually leaves, rather than assuming the full
 * device height the way the old proportional flex-[469] split did. That
 * mismatch was what pillarboxed the Barricade scene: shrinking a
 * fixed-aspect image's box height without a matching width change forces
 * object-contain to pad it narrower. Josh's own diagnosis + target spec
 * (Figma node 254:1236, "NightScreen_TargetSpec") — flex-1 min-h-0 here,
 * fixed h-[Npx] on Title/Coin/Score.
 *
 * SheetAreaBackdrop is a plain diagonal-stripe texture (Josh's own asset)
 * at low opacity, object-cover'd to fully fill the region regardless of
 * its actual rendered size -- overflow-hidden on this wrapper crops
 * whatever the texture's own aspect ratio doesn't line up with, so there's
 * no visible seam or gap at any size. Children are centered, not
 * stretched: each Sheet style owns its own content-sizing logic (Battle's
 * useUnitIconSize already adapts freely to whatever box it's given;
 * Barricade's useFitSheetWidth locks its own fixed-aspect scene art to the
 * largest size that still fits) -- SheetArea itself doesn't need to know
 * which.
 */
export function SheetArea({ children }: SheetAreaProps) {
  return (
    <div className="relative w-full min-h-0 flex-1 overflow-hidden">
      <img src={sheetAreaBackdrop} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
      <div className="relative flex h-full w-full items-center justify-center">{children}</div>
    </div>
  )
}
