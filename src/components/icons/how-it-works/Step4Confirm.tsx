/**
 * Step 4 — "Confirm & Release" icon.
 *
 * V36 — 3D tick PNG (`public/how-it-works/step-4.png`, transparent
 * background, 3dicons.co tick/dynamic/color — blue→green gradient).
 *
 * ▸ TO SWAP: drop a new PNG in `public/how-it-works/` and point src at
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
      src="/how-it-works/step-4.png"
      alt=""
      aria-hidden="true"
      className={className}
      {...props}
    />
  )
}
