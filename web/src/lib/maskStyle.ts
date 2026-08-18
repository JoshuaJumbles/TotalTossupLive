import type { CSSProperties } from 'react'

/**
 * A full-cover CSS mask from a URL — centered, scaled to fit without
 * cropping (the mask equivalent of object-fit: contain), no tiling.
 * Apply to an absolutely-positioned, colored element to tint an
 * alpha-only source image (a solid silhouette or line-art asset) with
 * whatever background color that element has — the technique behind
 * TeamArt's fill/line layers, the coin-flip hand, and CrossOutMark's ink.
 * Pulled out here since it's already used in more than one place and
 * likely to be reused again.
 */
export function maskStyle(url: string): CSSProperties {
  return {
    WebkitMaskImage: `url(${url})`,
    maskImage: `url(${url})`,
    WebkitMaskSize: 'contain',
    maskSize: 'contain',
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
  }
}
