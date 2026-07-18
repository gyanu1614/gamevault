'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, LayoutGrid, PlusCircle, Package, User } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { useAuthDialog } from '@/components/auth/AuthDialog'
import { cn } from '@/lib/utils'

/**
 * App-shell — Mobile bottom tab bar (below lg only).
 *
 * Fixed to the viewport bottom on every "normal-chrome" route (mounted by
 * layout-wrapper.tsx with the same exclusions as the navbar/footer, plus
 * /sell/* which owns its own sticky wizard bar). Forest-glass surface per
 * the design language: near-opaque forest gradient, lime-warmed top
 * hairline, faint lime top sheen, backdrop blur.
 *
 * Geometry contract (other fixed-bottom elements depend on this):
 *  - content row height = var(--mobile-tab-bar-h) (64px, globals.css)
 *  - the bar additionally pads env(safe-area-inset-bottom) BELOW the row
 *  - anything fixed above it sits at
 *    bottom-[calc(var(--mobile-tab-bar-h,64px)+env(safe-area-inset-bottom))]
 *  - z-40: below the navbar + its dropdowns (z-50) and the logout
 *    overlay (z-[100]); above page content.
 *
 * Active tab = lime icon + label + 3px lime indicator pill at the top
 * edge; inactive = tertiary grey. Every target is 20vw wide × 64px tall
 * (≥44px), with the house pressed state (scale + brightness, 120ms).
 */

type Tab = {
  id: string
  label: string
  href: string
  icon: LucideIcon
  /** Returns true when this tab owns the current pathname. */
  isActive: (pathname: string) => boolean
  /** Signed-out behavior: 'dialog' opens the auth modal instead of navigating. */
  guard?: 'dialog'
}

const TABS: Tab[] = [
  {
    id: 'home',
    label: 'Home',
    href: '/',
    icon: Home,
    isActive: (p) => p === '/',
  },
  {
    id: 'browse',
    label: 'Browse',
    href: '/browse',
    icon: LayoutGrid,
    isActive: (p) => p.startsWith('/browse'),
  },
  {
    // Sell wizard entry — /sell/new (see src/app/(sell)/sell/new). The
    // (sell) layout redirects signed-out users to /login?redirect=/sell/new.
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
    // Signed out → opens the AuthDialog (same hook the navbar uses)
    // instead of bouncing through the /account redirect.
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
  const { user } = useAuth()
  const authDialog = useAuthDialog()

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[rgba(163,230,53,0.12)] bg-[linear-gradient(180deg,rgba(20,36,26,0.96)_0%,rgba(14,22,17,0.98)_100%)] pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_30px_rgba(0,0,0,0.45)] backdrop-blur-xl backdrop-saturate-150 lg:hidden"
    >
      {/* Faint lime-warmed top sheen (forest-glass recipe) */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-6 bg-[linear-gradient(to_bottom,rgba(163,230,53,0.05),transparent)]"
      />
      <div className="grid h-[var(--mobile-tab-bar-h,64px)] grid-cols-5">
        {TABS.map((tab) => {
          const active = tab.isActive(pathname ?? '')
          const Icon = tab.icon
          const inner = (
            <>
              {/* 3px lime indicator pill on the active tab */}
              {active && (
                <span
                  aria-hidden
                  className="absolute inset-x-0 top-0 mx-auto h-[3px] w-9 rounded-full bg-lime shadow-[0_0_8px_rgba(163,230,53,0.5)]"
                />
              )}
              <Icon
                className={cn(
                  'h-[22px] w-[22px]',
                  active ? 'text-lime' : 'text-text-tertiary',
                )}
                strokeWidth={active ? 2.2 : 2}
              />
              <span
                className={cn(
                  'text-[10px] font-semibold leading-none',
                  active ? 'text-lime' : 'text-text-tertiary',
                )}
              >
                {tab.label}
              </span>
            </>
          )
          const itemClass = cn(
            'relative flex h-full min-h-[44px] flex-col items-center justify-center gap-1.5',
            'transition-[transform,filter] duration-[120ms] active:scale-[0.96] active:brightness-95',
          )

          // Signed-out Account tab opens the auth modal in place.
          if (tab.guard === 'dialog' && !user) {
            return (
              <button
                key={tab.id}
                type="button"
                className={itemClass}
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
              className={itemClass}
            >
              {inner}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
