/**
 * Step 2 — "Pay Securely" icon.
 *
 * V34 — 3D payment-card PNG (`public/how-it-works/step-2.png`,
 * transparent background): purple card + gold coin + green check.
 *
 * ▸ TO SWAP: drop a new PNG in `public/how-it-works/` and point src at
 *   it — keep `className` + `...props` passthrough. (The original
 *   stroke-SVG shield lives in git history.)
 */

import type { ImgHTMLAttributes } from 'react'

export default function Step2SecurePayment({
  className,
  ...props
}: ImgHTMLAttributes<HTMLImageElement>) {
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src="/how-it-works/step-2.png"
      alt=""
      aria-hidden="true"
      className={className}
      {...props}
    />
  )
}
