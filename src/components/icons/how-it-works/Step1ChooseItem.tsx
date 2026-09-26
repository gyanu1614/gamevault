/**
 * Step 1 — "Choose Your Item" icon.
 *
 * V33 — Now a 3D toy-sword AVIF (`public/how-it-works/step-1.avif`,
 * transparent background). The section gives PNG art its own brightness
 * treatment (near-full opacity when the step is active, dimmed +
 * grayscale when idle) — unlike the stroke-SVG steps, which use the
 * faint watermark tint.
 *
 * ▸ TO SWAP: drop a new AVIF in `public/how-it-works/` and point src at
 *   it — keep `className` + `...props` passthrough. (The original
 *   stroke-SVG sword lives in git history.)
 */

import type { ImgHTMLAttributes } from 'react'

export default function Step1ChooseItem({
  className,
  ...props
}: ImgHTMLAttributes<HTMLImageElement>) {
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src="/how-it-works/step-1.avif"
      alt=""
      aria-hidden="true"
      width={640}
      height={640}
      className={className}
      {...props}
    />
  )
}
