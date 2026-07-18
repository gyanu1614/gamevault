'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Home, Search, PlusCircle, Package, User } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Drawer } from 'vaul'
import { useAuth } from '@/hooks/use-auth'
import { useAuthDialog } from '@/components/auth/AuthDialog'
import { cn } from '@/lib/utils'

/**
 * App-shell — Mobile bottom tab bar (below lg only).
 *
 * GLASS surface: translucent near-black over heavy blur + saturate, a
 * bright hairline across the top edge, soft up-shadow — page content
 * scrolls visibly beneath it. SCROLL-AWARE: slides off while the page
 * scrolls down, returns on any upward scroll or near the top (300ms
 * transform only — the bar is fixed, nothing reflows).
 *
 * Tabs: Home · Search (vaul bottom sheet with an autofocused query
 * field — replaces the old Browse tab) · Sell · Orders · Account
 * (signed-out → AuthDialog).
 *
 * Geometry contract (other fixed-bottom elements depend on this):
 *  - content row height = var(--mobile-tab-bar-h) (64px, globals.css)
 *  - the bar additionally pads env(safe-area-inset-bottom) BELOW the row
 *  - anything fixed above it sits at
 *    bottom-[calc(var(--mobile-tab-bar-h,64px)+env(safe-area-inset-bottom))]
 *  - z-40: below the navbar + its dropdowns (z-50) and the logout
 *    overlay (z-[100]); above page content. The search sheet is z-50.
 */

type NavTab = {
  id: string
  label: string
  href: string
  icon: LucideIcon
  isActive: (pathname: string) => boolean
  /** Signed-out behavior: 'dialog' opens the auth modal instead of navigating. */
  guard?: 'dialog'
}

const LEFT_TABS: NavTab[] = [
  { id: 'home', label: 'Home', href: '/', icon: Home, isActive: (p) => p === '/' },
]

const RIGHT_TABS: NavTab[] = [
  {
    // Sell wizard entry — the (sell) layout handles the signed-out redirect.
    id: 'sell',
    label: 'Sell',
    href: '/sell/new',
    icon: PlusCircle,
    isActive: (p) => p.startsWith('/sell'),
  },
  {
    id: 'orders',
    label: 'Orders',
    href: '/account/orders',
    icon: Package,
    isActive: (p) => p.startsWith('/account/orders'),
  },
  {
    id: 'account',
    label: 'Account',
    href: '/account',
    icon: User,
    isActive: (p) => p.startsWith('/account') && !p.startsWith('/account/orders'),
    guard: 'dialog',
  },
]

export function BottomTabBar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useAuth()
  const authDialog = useAuthDialog()

  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')

  // ── Scroll-aware visibility: down hides, up (or near top) shows ──
  const [hidden, setHidden] = useState(false)
  const lastY = useRef(0)
  const ticking = useRef(false)
  useEffect(() => {
    lastY.current = window.scrollY
    const onScroll = () => {
      if (ticking.current) return
      ticking.current = true
      requestAnimationFrame(() => {
        const y = window.scrollY
        const delta = y - lastY.current
        if (y < 80) setHidden(false)
        else if (delta > 6) setHidden(true)
        else if (delta < -6) setHidden(false)
        lastY.current = y
        ticking.current = false
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    setSearchOpen(false)
    setQuery('')
    router.push(q ? `/browse?search=${encodeURIComponent(q)}` : '/browse')
  }

  const itemClass = (active: boolean) =>
    cn(
      'relative flex h-full min-h-[44px] flex-1 flex-col items-center justify-center gap-1.5',
      'transition-[transform,filter] duration-[120ms] active:scale-[0.94] active:brightness-95',
      active ? 'text-lime' : 'text-text-tertiary',
    )

  const renderTab = (tab: NavTab) => {
    const active = tab.isActive(pathname ?? '')
    const Icon = tab.icon
    const inner = (
      <>
        {active && (
          <span
            aria-hidden
            className="absolute inset-x-0 top-0 mx-auto h-[3px] w-9 rounded-full bg-lime shadow-[0_0_10px_rgba(163,230,53,0.6)]"
          />
        )}
        <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.2 : 1.8} />
        <span className="text-[10px] font-semibold leading-none">{tab.label}</span>
      </>
    )
    if (tab.guard === 'dialog' && !user) {
      return (
        <button
          key={tab.id}
          type="button"
          className={itemClass(active)}
          onClick={() => authDialog.open('login')}
        >
          {inner}
        </button>
      )
    }
    return (
      <Link
        key={tab.id}
        href={tab.href}
        aria-current={active ? 'page' : undefined}
        className={itemClass(active)}
      >
        {inner}
      </Link>
    )
  }

  return (
    <>
      <nav
        aria-label="Primary"
        className={cn(
          'fixed inset-x-0 bottom-0 z-40 lg:hidden',
          'transition-transform duration-300 ease-gv',
          hidden && 'translate-y-[110%]',
        )}
      >
        {/* Glass slab — translucent, heavy blur, bright top hairline */}
        <div className="relative border-t border-white/[0.08] bg-[rgba(13,14,15,0.72)] pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_34px_rgba(0,0,0,0.5)] backdrop-blur-2xl backdrop-saturate-150">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(to_right,transparent,rgba(255,255,255,0.16)_50%,transparent)]"
          />
          <div className="flex h-[var(--mobile-tab-bar-h,64px)] items-stretch">
            {LEFT_TABS.map(renderTab)}
            {/* Search — slides the sheet up, keyboard opens */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className={itemClass(false)}
            >
              <Search className="h-[22px] w-[22px]" strokeWidth={1.8} />
              <span className="text-[10px] font-semibold leading-none">Search</span>
            </button>
            {RIGHT_TABS.map(renderTab)}
          </div>
        </div>
      </nav>

      {/* Search sheet — vaul: springs from the bottom, drag to dismiss. */}
      <Drawer.Root open={searchOpen} onOpenChange={setSearchOpen}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px]" />
          <Drawer.Content
            aria-describedby={undefined}
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-white/[0.10] bg-[rgba(19,20,22,0.97)] p-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-[0_-16px_50px_rgba(0,0,0,0.6)] backdrop-blur-xl"
          >
            <div aria-hidden className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
            <Drawer.Title className="sr-only">Search DropMarket</Drawer.Title>
            <form onSubmit={submitSearch}>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-500" />
                {/* 16px input — no iOS zoom; autoFocus pops the keyboard. */}
                <input
                  autoFocus
                  type="search"
                  enterKeyHint="search"
                  placeholder="Search games, items, currency…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="min-h-[52px] w-full rounded-xl border border-white/[0.10] bg-white/[0.05] pl-12 pr-4 text-base text-white outline-none transition-colors placeholder:text-gray-500 focus:border-white/[0.2] focus:bg-white/[0.07]"
                />
              </div>
              <button
                type="submit"
                className="mt-3 flex h-12 w-full items-center justify-center rounded-xl bg-[#14432A] text-[15px] font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16),inset_0_-2px_0_rgba(0,0,0,0.28)] transition-all duration-[120ms] hover:bg-[#1B5E3A] active:scale-[0.98]"
              >
                Search
              </button>
            </form>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </>
  )
}
