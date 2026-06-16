/**
 * V14j — Route-level loading UI for /checkout/[id].
 *
 * Next.js renders this while the server fetches the listing + auth user.
 * Matches the in-page RouteLoader styling on the currency page so the
 * transition feels continuous (lime ring spinner + soft glow).
 */

import { Zap } from 'lucide-react'

export default function CheckoutLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-bg-base/70 backdrop-blur-md"
    >
      <div className="relative flex flex-col items-center gap-4">
        <div
          aria-hidden
          className="absolute inset-0 -m-8 rounded-full bg-lime/10 blur-2xl animate-pulse"
        />
        <div className="relative flex h-14 w-14 items-center justify-center">
          <div aria-hidden className="absolute inset-0 rounded-full border-2 border-border-subtle" />
          <div
            aria-hidden
            className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-lime border-r-lime"
            style={{ animationDuration: '0.9s' }}
          />
          <Zap className="h-5 w-5 text-lime" />
        </div>
        <div className="relative text-center">
          <div className="text-[14px] font-semibold text-text-primary">Preparing checkout</div>
          <div className="mt-0.5 text-[12px] text-text-tertiary">Hang tight — one moment</div>
        </div>
      </div>
    </div>
  )
}
