'use client'

import { usePathname } from 'next/navigation'
import { CaretRightIcon } from '@phosphor-icons/react/dist/csr/CaretRight'
import { ListIcon } from '@phosphor-icons/react/dist/csr/List'
import { cn } from '@/lib/utils'

/**
 * These pages fill the screen themselves, over the layout's flow, so the row can't sit in
 * the layout there. Offers and Orders draw it inside; Messages leaves the room to the thread.
 */
const FILLS_THE_SCREEN = new Set(['/account/listings', '/account/orders', '/account/messages'])

/**
 * Phones only: opens the account sidebar. The navbar's panel icon does too, but a
 * new seller wouldn't know that small icon holds their pages (owner, 2026-11-06),
 * so the top of every account page says it in words.
 */
export function AccountMenuRow({ isSeller, inPage = false }: { isSeller: boolean; inPage?: boolean }) {
  const pathname = usePathname()
  if (!inPage && FILLS_THE_SCREEN.has(pathname)) return null
  return (
    <div className={cn('lg:hidden', inPage ? 'mb-4 shrink-0' : 'px-4 pb-5 sm:px-6')}>
      <button
        type="button"
        aria-haspopup="menu"
        onClick={() => window.dispatchEvent(new Event('dm:toggle-account-sidebar'))}
        className="flex h-11 w-full items-center gap-3 rounded-md bg-white/[0.07] px-3 text-left text-[14px] font-semibold text-text-primary transition-colors active:bg-white/[0.11]"
      >
        <ListIcon size={18} weight="bold" aria-hidden className="shrink-0" />
        <span className="min-w-0 flex-1 truncate">{isSeller ? 'Seller Menu' : 'Account Menu'}</span>
        <CaretRightIcon size={14} weight="bold" aria-hidden className="shrink-0 text-text-tertiary" />
      </button>
    </div>
  )
}
