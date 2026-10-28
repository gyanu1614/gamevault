'use client'

/**
 * CheckoutNavbar — the shared dark strip over every checkout-flow surface
 * (checkout page + payment page): logo home-link left, Need Help + the
 * site's own account menu right. One component so the two pages stay pixel-identical.
 */

import Link from '@/components/navigation/AppLink'
import { Info } from 'lucide-react'
import { AccountMenu } from './AccountMenu'

export function CheckoutNavbar() {
  return (
    // backdrop-blur-0 is invisible but load-bearing (as on the site bar): it
    // makes this strip the containing block for the account menu's `fixed
    // top-full` phone sheet, so the sheet hangs flush under the bar.
    <div
      className="relative z-50 flex h-16 items-center justify-between px-4 backdrop-blur-0 sm:px-10"
      style={{ background: '#16171B' }}
    >
      <Link href="/" className="inline-flex items-center gap-2 transition-opacity hover:opacity-85">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-mark-green.avif" alt="" width={96} height={96} className="h-6 w-6" />
        <span className="text-[15px] font-bold" style={{ color: '#E9EDF2' }}>
          DropMarket
        </span>
      </Link>
      <div className="flex items-center gap-2 sm:gap-4">
        <Link
          href="/support"
          className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Info className="h-4 w-4" />
          <span className="hidden sm:inline">Need Help?</span>
        </Link>
        <AccountMenu />
      </div>
    </div>
  )
}
