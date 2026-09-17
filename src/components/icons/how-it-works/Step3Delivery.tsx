/**
 * Step 3 — "Get Your Delivery" icon.
 *
 * V35 — 3D alarm-clock AVIF (`public/how-it-works/step-3.avif`,
 * transparent background, 3dicons.co clock/dynamic/color).
 *
 * ▸ TO SWAP: drop a new AVIF in `public/how-it-works/` and point src at
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
      src="/how-it-works/step-3.avif"
      alt=""
      aria-hidden="true"
      width={640}
      height={640}
      className={className}
      {...props}
    />
  )
}
