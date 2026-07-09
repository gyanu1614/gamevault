/**
 * /account — Account overview.
 *
 * V6 reskin: GV tokens, lime accent for primary actions, mobile-first
 * grid. Server component (no client interactivity required).
 */

import { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  ShoppingCart, MessageSquare, Package, TrendingUp, ArrowRight,
  Heart, Wallet, Star, Settings, type LucideIcon,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'My Account',
  description: 'Manage your orders, messages, and account settings',
}

interface CardSpec {
  href: string
  icon: LucideIcon
  title: string
  metric: string
  cta: string
  badge?: number
}

export default async function AccountPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: sellerApp } = await supabase
    .from('seller_applications')
    .select('status')
    .eq('user_id', user.id)
    .single() as any
  const isApprovedSeller = sellerApp?.status === 'approved'

  const [{ count: buyerOrdersCount }, sellerOrdersRes, { count: unreadCount }] = await Promise.all([
    supabase.from('orders').select('*', { count: 'exact', head: true }).eq('buyer_id', user.id),
    isApprovedSeller
      ? supabase.from('orders').select('*', { count: 'exact', head: true }).eq('seller_id', user.id)
      : Promise.resolve({ count: 0 } as any),
    supabase.from('messages').select('*', { count: 'exact', head: true })
      .eq('receiver_id', user.id).eq('read', false),
  ])
  const sellerOrdersCount = (sellerOrdersRes as any)?.count ?? 0

  const cards: CardSpec[] = [
    {
      href: '/account/orders',
      icon: ShoppingCart,
      title: 'Orders',
      metric: isApprovedSeller
        ? `${buyerOrdersCount || 0} purchases · ${sellerOrdersCount || 0} sales`
        : `${buyerOrdersCount || 0} order${(buyerOrdersCount || 0) === 1 ? '' : 's'}`,
      cta: 'View all orders',
    },
    {
      href: '/account/messages',
      icon: MessageSquare,
      title: 'Messages',
      metric:
        (unreadCount || 0) > 0
          ? `${unreadCount} unread`
          : 'No unread messages',
      cta: 'Open inbox',
      badge: unreadCount ?? 0,
    },
    {
      href: '/account/wishlist',
      icon: Heart,
      title: 'Wishlist',
      metric: 'Saved items',
      cta: 'View wishlist',
    },
    {
      href: '/account/wallet',
      icon: Wallet,
      title: 'Wallet',
      metric: 'Balance & cashback',
      cta: 'Open wallet',
    },
    {
      href: '/account/reviews',
      icon: Star,
      title: 'Reviews',
      metric: 'Your purchases',
      cta: 'See reviews',
    },
    {
      href: '/account/settings',
      icon: Settings,
      title: 'Settings',
      metric: 'Profile, security, payouts',
      cta: 'Open settings',
    },
  ]

  if (isApprovedSeller) {
    cards.splice(2, 0,
      {
        href: '/account/listings',
        icon: Package,
        title: 'My listings',
        metric: 'Manage offers',
        cta: 'View listings',
      },
      {
        href: '/account/analytics',
        icon: TrendingUp,
        title: 'Analytics',
        metric: 'Sales performance',
        cta: 'View analytics',
      },
    )
  }

  const username = (user as any).user_metadata?.username ?? user.email?.split('@')[0] ?? 'there'

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary sm:text-3xl">
          Welcome back, {username}
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          {isApprovedSeller
            ? 'Manage your purchases, sales, and seller tools.'
            : 'Manage your purchases, messages, and settings.'}
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => {
          const Icon = c.icon
          return (
            <Link
              key={c.href}
              href={c.href}
              className="group block rounded-2xl border border-border-subtle bg-bg-overlay p-5 transition-colors hover:border-lime-tint-border hover:bg-bg-raised-hover"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border-default bg-bg-raised">
                  <Icon className="h-5 w-5 text-text-secondary group-hover:text-lime-text" />
                  {c.badge && c.badge > 0 ? (
                    <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold text-text-primary">
                      {c.badge > 9 ? '9+' : c.badge}
                    </span>
                  ) : null}
                </div>
                <ArrowRight className="h-4 w-4 text-text-tertiary transition-colors group-hover:text-lime-text" />
              </div>
              <h3 className="text-base font-semibold text-text-primary">{c.title}</h3>
              <p className="mt-0.5 text-sm text-text-secondary">{c.metric}</p>
              <div className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary group-hover:text-lime-text">
                {c.cta} →
              </div>
            </Link>
          )
        })}
      </div>
    </main>
  )
}
