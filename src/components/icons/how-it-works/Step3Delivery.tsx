/**
 * Step 3 — "Get Your Delivery" icon.
 *
 * V35 — 3D alarm-clock PNG (`public/how-it-works/step-3.png`,
 * transparent background, 3dicons.co clock/dynamic/color).
 *
 * ▸ TO SWAP: drop a new PNG in `public/how-it-works/` and point src at
 *   it — keep `className` + `...props` passthrough. (The original
 *   stroke-SVG bolt lives in git history.)
 */

import type { ImgHTMLAttributes } from 'react'

export default function Step3Delivery({
  className,
  ...props
}: ImgHTMLAttributes<HTMLImageElement>) {
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src="/how-it-works/step-3.png"
      alt=""
      aria-hidden="true"
      className={className}
      {...props}
    />
  )
}
