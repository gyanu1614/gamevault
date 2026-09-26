/**
 * Step 4 — "Confirm & Release" icon.
 *
 * V36 — 3D tick AVIF (`public/how-it-works/step-4.avif`, transparent
 * background, 3dicons.co tick/dynamic/color — blue→green gradient).
 *
 * ▸ TO SWAP: drop a new AVIF in `public/how-it-works/` and point src at
 *   it — keep `className` + `...props` passthrough. (The original
 *   stroke-SVG trophy lives in git history.)
 */

import type { ImgHTMLAttributes } from 'react'

export default function Step4Confirm({
  className,
  ...props
}: ImgHTMLAttributes<HTMLImageElement>) {
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src="/how-it-works/step-4.avif"
      alt=""
      aria-hidden="true"
      width={640}
      height={640}
      className={className}
      {...props}
    />
  )
}
