/**
 * BuyingOpensSoonBanner — seller-facing notice while PURCHASES_ENABLED is off:
 * their listings stay live and visible, buyers just can't check out yet. Keeps
 * founding sellers from reading "no sales" as "something is broken". Renders
 * nothing once purchases flip on.
 */

import { Clock } from 'lucide-react'
import { PURCHASES_ENABLED } from '@/lib/config/purchases'

export default function BuyingOpensSoonBanner() {
  if (PURCHASES_ENABLED) return null
  return (
    <div className="mx-auto mb-4 w-full max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="flex items-start gap-2.5 rounded-xl border border-lime-400/25 bg-lime-400/[0.07] px-4 py-3">
        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-lime-300" />
        <p className="text-[13px] leading-relaxed text-white/80">
          <span className="font-semibold text-lime-200">Buying Opens Soon</span>
          {' '}— your listings are live and visible to buyers. Checkout unlocks
          when payments launch; we&rsquo;ll notify you the moment it happens.
        </p>
      </div>
    </div>
  )
}
