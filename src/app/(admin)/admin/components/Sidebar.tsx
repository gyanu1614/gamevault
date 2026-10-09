'use client'

/**
 * Admin sidebar (account-section design, 2026-09-30 overhaul).
 *
 * - Desktop (lg+): a floating fill-only card (no outline, no gradient), the
 *   same surface as the account sidebar. Collapses to a 64px icon rail; the
 *   rail width is animated by AdminChrome, labels fade with framer-motion and
 *   show as tooltips while collapsed.
 * - Phones/tablets (<lg): the same nav in a left drawer (vaul: swipe or tap
 *   outside to close, focus kept inside while open), opened from the header's
 *   menu button.
 * - Links are grouped by job; GDPR / INFORM Act / Reviews / Activities stay
 *   routable (header search, dashboard) without taking rail space.
 */

import { AnimatePresence, motion } from 'framer-motion'
import Image from 'next/image'
import Link from '@/components/navigation/AppLink'
import { usePathname, useRouter } from 'next/navigation'
import { Drawer } from 'vaul'
import {
  Article,
  ChartLineUp,
  GameController,
  UserCircle,
  HandCoins,
  ListChecks,
  Megaphone,
  Percent,
  Receipt,
  RocketLaunch,
  Scales,
  ShieldWarning,
  SidebarSimple,
  SignOut,
  SquaresFour,
  Storefront,
  Target,
  Ticket,
  UserPlus,
  X,
  UsersThree,
  Flag,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface SidebarProps {
  role: string
  collapsed?: boolean
  onToggle?: () => void
  mobileOpen: boolean
  onMobileOpenChange: (open: boolean) => void
}

type Role = 'admin' | 'moderator' | 'support' | 'super_admin'
interface NavLink {
  label: string
  href: string
  icon: PhosphorIcon
  roles: Role[]
}

const ALL: Role[] = ['admin', 'moderator', 'support', 'super_admin']

const GROUPS: { title: string | null; links: NavLink[] }[] = [
  {
    title: null,
    links: [
      { label: 'Dashboard', href: '/admin', icon: SquaresFour, roles: ALL },
      { label: 'Analytics', href: '/admin/analytics', icon: ChartLineUp, roles: ['admin', 'super_admin'] },
    ],
  },
  {
    title: 'Orders & Money',
    links: [
      { label: 'Orders', href: '/admin/orders', icon: Receipt, roles: ['admin', 'support', 'super_admin'] },
      { label: 'Withdrawals', href: '/admin/withdrawals', icon: HandCoins, roles: ['admin', 'super_admin'] },
      { label: 'Fees & Payouts', href: '/admin/fees', icon: Percent, roles: ['admin', 'super_admin'] },
    ],
  },
  {
    title: 'Sellers',
    links: [
      { label: 'Sellers', href: '/admin/all-sellers', icon: UsersThree, roles: ALL },
      { label: 'Seller Applications', href: '/admin/sellers', icon: UserPlus, roles: ['admin', 'moderator', 'super_admin'] },
      { label: 'Active Sellers', href: '/admin/active-sellers', icon: Storefront, roles: ALL },
      { label: 'Founding Sellers', href: '/admin/early-sellers', icon: RocketLaunch, roles: ['admin', 'super_admin'] },
      { label: 'Seller Leads', href: '/admin/seller-leads', icon: Target, roles: ['admin', 'super_admin'] },
      { label: 'Founding Notices', href: '/admin/founding-notices', icon: Megaphone, roles: ['admin', 'super_admin'] },
    ],
  },
  {
    title: 'Trust & Safety',
    links: [
      { label: 'Disputes', href: '/admin/disputes', icon: Scales, roles: ['admin', 'support', 'super_admin'] },
      { label: 'Fraud', href: '/admin/fraud', icon: ShieldWarning, roles: ['admin', 'super_admin'] },
      { label: 'Moderation', href: '/admin/moderation', icon: ListChecks, roles: ['admin', 'moderator', 'super_admin'] },
      { label: 'Reports', href: '/admin/reports', icon: Flag, roles: ['admin', 'moderator', 'super_admin'] },
    ],
  },
  {
    title: 'Catalogue',
    links: [
      { label: 'Games', href: '/admin/games', icon: GameController, roles: ['admin', 'super_admin'] },
      { label: 'Blog & Content', href: '/admin/blog', icon: Article, roles: ['admin', 'super_admin'] },
      { label: 'Promo Codes', href: '/admin/promos', icon: Ticket, roles: ['admin', 'super_admin'] },
    ],
  },
  {
    title: 'Account',
    links: [
      { label: 'Profile', href: '/admin/profile', icon: UserCircle, roles: ALL },
    ],
  },
]

const fade = {
  initial: { opacity: 0, x: -6 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -6 },
  transition: { duration: 0.16 },
}

export function Sidebar({ role, collapsed = false, onToggle, mobileOpen, onMobileOpenChange }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    await createClient().auth.signOut()
    router.push('/login')
  }

  const groups = GROUPS.map((g) => ({ ...g, links: g.links.filter((l) => l.roles.includes(role as Role)) })).filter(
    (g) => g.links.length > 0,
  )

  const isActive = (href: string) => pathname === href || (href !== '/admin' && pathname.startsWith(href))

  /** The nav list, shared by the desktop card and the phone drawer. */
  const navList = (rail: boolean, onNavigate?: () => void) => (
    <nav aria-label="Admin" className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 pb-3">
      {groups.map((group, gi) => (
        <div key={group.title ?? 'top'} className={cn(gi > 0 && 'mt-4')}>
          {group.title &&
            (rail ? (
              <div className="mx-auto mb-2 h-px w-6 bg-white/[0.08]" aria-hidden />
            ) : (
              <p className="mb-1 px-3 text-[12px] font-medium text-text-tertiary">{group.title}</p>
            ))}
          <ul className="space-y-0.5">
            {group.links.map((link) => {
              const active = isActive(link.href)
              const Icon = link.icon
              const row = (
                <Link
                  href={link.href}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  aria-label={rail ? link.label : undefined}
                  className={cn(
                    'group flex h-10 items-center gap-3 rounded-md text-[14px] font-medium transition-colors duration-150',
                    rail ? 'justify-center px-0' : 'px-3',
                    active
                      ? 'bg-[rgba(198,255,61,0.13)] text-lime-text'
                      : 'text-text-secondary hover:bg-white/[0.05] hover:text-text-primary',
                  )}
                >
                  <Icon
                    aria-hidden
                    weight={active ? 'fill' : 'bold'}
                    className={cn(
                      'h-[19px] w-[19px] shrink-0 transition-colors',
                      !active && 'text-text-tertiary group-hover:text-text-primary',
                    )}
                  />
                  <AnimatePresence initial={false}>
                    {!rail && (
                      <motion.span {...fade} className="truncate whitespace-nowrap">
                        {link.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </Link>
              )
              return (
                <li key={link.href}>
                  {rail ? (
                    <Tooltip delayDuration={120}>
                      <TooltipTrigger asChild>{row}</TooltipTrigger>
                      <TooltipContent side="right" className="border-0 bg-bg-overlay-2 text-[12.5px] font-medium">
                        {link.label}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    row
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )

  const logoutRow = (rail: boolean) => (
    <div className="shrink-0 border-t border-white/[0.06] p-2">
      <button
        type="button"
        onClick={handleLogout}
        aria-label={rail ? 'Log Out' : undefined}
        className={cn(
          'group flex h-10 w-full items-center gap-3 rounded-md text-[14px] font-medium text-text-secondary transition-colors hover:bg-[color-mix(in_srgb,var(--color-error)_10%,transparent)] hover:text-error',
          rail ? 'justify-center px-0' : 'px-3',
        )}
      >
        <SignOut aria-hidden weight="bold" className="h-[19px] w-[19px] shrink-0" />
        {!rail && <span>Log Out</span>}
      </button>
    </div>
  )

  const brand = (
    <Link href="/admin" className="flex min-w-0 items-center gap-2.5">
      <Image src="/brand/logo-mark-white.png" alt="" width={26} height={26} priority className="shrink-0" />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-[15px] font-bold leading-tight tracking-tight text-text-primary">DropMarket</span>
        <span className="text-[11.5px] font-medium leading-tight text-text-tertiary">Admin</span>
      </span>
    </Link>
  )

  return (
    <>
      {/* ── Desktop: floating card, collapsible to an icon rail ── */}
      <aside
        className={cn(
          'fixed bottom-3 left-3 top-3 z-40 hidden flex-col overflow-hidden rounded-lg bg-bg-raised lg:flex',
          'transition-[width] duration-300 ease-out',
          collapsed ? 'w-16' : 'w-[232px]',
        )}
      >
        <div className={cn('flex h-16 shrink-0 items-center', collapsed ? 'justify-center' : 'justify-between pl-4 pr-2')}>
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.div {...fade} className="min-w-0">
                {brand}
              </motion.div>
            )}
          </AnimatePresence>
          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-text-tertiary transition-colors hover:bg-white/[0.06] hover:text-text-primary"
          >
            <SidebarSimple aria-hidden weight="bold" className="h-[19px] w-[19px]" />
          </button>
        </div>
        {navList(collapsed)}
        {logoutRow(collapsed)}
      </aside>

      {/* ── Phones / tablets: left drawer ── */}
      <Drawer.Root direction="left" open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-black/60 lg:hidden" />
          <Drawer.Content
            aria-describedby={undefined}
            className="fixed inset-y-0 left-0 z-50 flex w-[min(84vw,300px)] flex-col bg-bg-raised outline-none lg:hidden"
          >
            <Drawer.Title className="sr-only">Admin Navigation</Drawer.Title>
            <div className="flex h-16 shrink-0 items-center justify-between pl-4 pr-2">
              <div onClick={() => onMobileOpenChange(false)} className="min-w-0">
                {brand}
              </div>
              <button
                type="button"
                onClick={() => onMobileOpenChange(false)}
                aria-label="Close menu"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-md text-text-secondary transition-colors hover:bg-white/[0.06] hover:text-text-primary"
              >
                <X aria-hidden weight="bold" className="h-5 w-5" />
              </button>
            </div>
            {navList(false, () => onMobileOpenChange(false))}
            <div className="pb-[env(safe-area-inset-bottom)]">{logoutRow(false)}</div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </>
  )
}
