'use client'

/**
 * The profile dropdown's content (owner, 2026-09-30: the Seller Dashboard
 * row, the Sell button and the tier line "aren't good, make them perfect").
 *
 *   Seller header: avatar + name + blue VerifiedBadge (→ shop), the tier as a
 *   small chip "🥇 Gold Seller ›" (→ /account/tiers), then two equal actions:
 *   Sell (the one green CTA in the menu) and View Shop.
 *   Rows: one 40px row style for everything, Seller Dashboard included (it
 *   leads the list instead of wearing its own bordered block). Wallet shows
 *   the live balance, Messages the unread count, Offline Mode a real switch.
 *   Buyer header: avatar + username + Rookie chip + member-since line.
 *
 * State (offline mode, balance, unread) lives in the Navbar, which passes it
 * in; this file only draws it.
 */

import Link from '@/components/navigation/AppLink'
import {
  SquaresFourIcon,
  ReceiptIcon,
  TagIcon,
  WalletIcon,
  PowerIcon,
  ChatCircleDotsIcon,
  StarIcon,
  GearSixIcon,
  LifebuoyIcon,
  SignOutIcon,
  ShieldCheckIcon,
  PlusIcon,
  StorefrontIcon,
  CaretRightIcon,
  SparkleIcon,
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { getAvatarUrl } from '@/lib/utils/avatar'
import { sellerDisplayName, sellerShopSlug } from '@/lib/seller/identity'
import { tierByKey, DEFAULT_TIER } from '@/lib/seller/tiers'
import SellerTierBadge from '@/components/seller/tiers/SellerTierBadge'
import { VerifiedBadge } from '@/components/seller/VerifiedBadge'
import BecomeSellerCta from '@/components/account/BecomeSellerCta'
import { BuyButtonFace } from '@/components/marketplace/BuyButton'
import { NavMenuDivider, navMenuIconCls, navMenuRowCls } from './NavChrome'

const ICON = 18

interface ProfileMenuProps {
  user: any
  isAdmin: boolean
  walletBalance: number | null
  unreadMessages: number
  offlineMode: boolean
  pendingOffline: boolean
  onToggleOffline: () => void
  /** Closes the menu after a navigation. */
  onNavigate: () => void
  onLogout: () => void
}

function Row({
  href,
  icon: Icon,
  label,
  onNavigate,
  trailing,
}: {
  href: string
  icon: typeof ReceiptIcon
  label: string
  onNavigate: () => void
  trailing?: React.ReactNode
}) {
  return (
    <Link href={href} onClick={onNavigate} className={navMenuRowCls}>
      <Icon size={ICON} weight="bold" aria-hidden className={navMenuIconCls} />
      <span className="truncate">{label}</span>
      {trailing}
    </Link>
  )
}

function Trailing({ children }: { children: React.ReactNode }) {
  return <span className="ml-auto text-[13.5px] font-semibold tabular-nums text-text-primary">{children}</span>
}

function UnreadCount({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white/[0.09] px-1.5 text-[11.5px] font-semibold tabular-nums text-text-primary">
      {count > 99 ? '99+' : count}
    </span>
  )
}

function Avatar({ user, className }: { user: any; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={getAvatarUrl(user.profile?.avatar_url, user.profile?.username || 'user')}
      alt=""
      width={44}
      height={44}
      className={cn('h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-white/10', className)}
    />
  )
}

function SellerHeader({ user, onNavigate }: { user: any; onNavigate: () => void }) {
  const shopHref = `/shop/${sellerShopSlug(user.profile) ?? ''}`
  const tier = tierByKey(user.profile?.seller_tier || DEFAULT_TIER)
  return (
    <div className="p-3 pb-2">
      <div className="flex items-center gap-3 px-1">
        <Link href={shopHref} onClick={onNavigate} className="shrink-0 rounded-full transition-opacity hover:opacity-90" aria-label="View Shop">
          <Avatar user={user} />
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={shopHref} onClick={onNavigate} className="flex min-w-0 items-center gap-1.5 hover:underline decoration-white/30 underline-offset-4">
            <span className="truncate text-[15px] font-semibold leading-tight text-text-primary">{sellerDisplayName(user.profile)}</span>
            {user.profile?.is_verified && <VerifiedBadge size={15} />}
          </Link>
          <Link
            href="/account/tiers"
            onClick={onNavigate}
            className="group/tier mt-1.5 inline-flex h-6 items-center gap-1.5 rounded-md bg-white/[0.05] pl-1 pr-1.5 text-[12px] font-medium text-text-secondary transition-colors hover:bg-white/[0.09]"
          >
            <SellerTierBadge tier={tier.key} size={16} float={false} />
            <span>
              <span className={cn('font-semibold', tier.colors.text)}>{tier.label}</span> Seller
            </span>
            <CaretRightIcon size={10} weight="bold" aria-hidden className="text-text-tertiary transition-transform group-hover/tier:translate-x-0.5" />
          </Link>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link href="/sell/new" onClick={onNavigate} className="group rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40">
          <BuyButtonFace size="sm" icon={null} className="w-full">
            <PlusIcon size={15} weight="bold" aria-hidden />
            Sell
          </BuyButtonFace>
        </Link>
        <Link
          href={shopHref}
          onClick={onNavigate}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-white/[0.07] px-3 text-[13.5px] font-semibold text-text-primary transition-[background-color,transform] hover:bg-white/[0.11] active:scale-[0.98]"
        >
          <StorefrontIcon size={15} weight="bold" aria-hidden />
          View Shop
        </Link>
      </div>
    </div>
  )
}

function BuyerHeader({ user }: { user: any }) {
  return (
    <div className="flex items-center gap-3 p-3 pb-2">
      <Avatar user={user} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[15px] font-semibold leading-tight text-text-primary">{user.profile?.username || 'User'}</span>
          <span className="inline-flex h-5 flex-none items-center gap-1 rounded-md bg-info-bg px-1.5 text-[11px] font-semibold text-info">
            <SparkleIcon size={11} weight="fill" aria-hidden />
            Rookie
          </span>
        </div>
        <div className="mt-1 text-[12px] text-text-tertiary">
          Member Since {new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
        </div>
      </div>
    </div>
  )
}

function OfflineSwitch({ on, pending, onToggle }: { on: boolean; pending: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={pending}
      onClick={onToggle}
      className={cn(navMenuRowCls, 'h-auto min-h-10 py-2 disabled:opacity-60')}
    >
      <PowerIcon size={ICON} weight="bold" aria-hidden className={cn(navMenuIconCls, on && 'text-amber-400 group-hover:text-amber-400')} />
      <span className="flex min-w-0 flex-col items-start text-left">
        <span className="leading-tight">Offline Mode</span>
        <span className="mt-0.5 text-[12px] font-normal leading-tight text-text-tertiary">
          {on ? 'Offers hidden from buyers' : 'Your offers are live'}
        </span>
      </span>
      <span
        aria-hidden
        className={cn(
          'ml-auto flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200',
          on ? 'bg-amber-400' : 'bg-white/[0.14]',
        )}
      >
        <span
          className={cn(
            'h-4 w-4 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.4)] transition-transform duration-200 ease-out',
            on ? 'translate-x-4' : 'translate-x-0',
          )}
        />
      </span>
    </button>
  )
}

export function ProfileMenu({
  user,
  isAdmin,
  walletBalance,
  unreadMessages,
  offlineMode,
  pendingOffline,
  onToggleOffline,
  onNavigate,
  onLogout,
}: ProfileMenuProps) {
  const isSeller = Boolean(user.isApprovedSeller)
  const balance = walletBalance != null ? `$${walletBalance.toFixed(2)}` : null

  return (
    <div className="min-h-0 overflow-y-auto overscroll-contain">
      {isSeller ? <SellerHeader user={user} onNavigate={onNavigate} /> : <BuyerHeader user={user} />}

      <div className="px-2 pb-2">
        <NavMenuDivider />

        {isAdmin && (
          <>
            <Row href="/admin" icon={ShieldCheckIcon} label="Admin Panel" onNavigate={onNavigate} />
            <NavMenuDivider />
          </>
        )}

        {isSeller ? (
          <>
            <Row href="/account/dashboard" icon={SquaresFourIcon} label="Seller Dashboard" onNavigate={onNavigate} />
            <Row href="/account/orders" icon={ReceiptIcon} label="Orders" onNavigate={onNavigate} />
            <Row href="/account/listings" icon={TagIcon} label="Offers" onNavigate={onNavigate} />
            <Row
              href="/account/wallet"
              icon={WalletIcon}
              label="Wallet"
              onNavigate={onNavigate}
              trailing={balance && <Trailing>{balance}</Trailing>}
            />
            <NavMenuDivider />
            <OfflineSwitch on={offlineMode} pending={pendingOffline} onToggle={onToggleOffline} />
            <NavMenuDivider />
            <Row
              href="/account/messages"
              icon={ChatCircleDotsIcon}
              label="Messages"
              onNavigate={onNavigate}
              trailing={<UnreadCount count={unreadMessages} />}
            />
            <Row href="/account/reviews" icon={StarIcon} label="Feedback" onNavigate={onNavigate} />
            <Row href="/account/settings" icon={GearSixIcon} label="Settings" onNavigate={onNavigate} />
            <Row href="/support" icon={LifebuoyIcon} label="Support" onNavigate={onNavigate} />
          </>
        ) : (
          <>
            <Row href="/account/dashboard" icon={SquaresFourIcon} label="Dashboard" onNavigate={onNavigate} />
            <BecomeSellerCta variant="menu" onNavigate={onNavigate} />
            <NavMenuDivider />
            <Row href="/account/orders" icon={ReceiptIcon} label="Orders" onNavigate={onNavigate} />
            <Row
              href="/account/wallet"
              icon={WalletIcon}
              label="Wallet"
              onNavigate={onNavigate}
              trailing={balance && <Trailing>{balance}</Trailing>}
            />
            <NavMenuDivider />
            <Row
              href="/account/messages"
              icon={ChatCircleDotsIcon}
              label="Messages"
              onNavigate={onNavigate}
              trailing={<UnreadCount count={unreadMessages} />}
            />
            <Row href="/account/settings" icon={GearSixIcon} label="Settings" onNavigate={onNavigate} />
            <Row href="/support" icon={LifebuoyIcon} label="Support" onNavigate={onNavigate} />
          </>
        )}

        <NavMenuDivider />
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onLogout()
          }}
          className={cn(navMenuRowCls, 'text-red-400 hover:bg-red-500/10 hover:text-red-300 focus-visible:bg-red-500/10 focus-visible:text-red-300')}
        >
          <SignOutIcon size={ICON} weight="bold" aria-hidden className="shrink-0" />
          Log Out
        </button>
      </div>
    </div>
  )
}
