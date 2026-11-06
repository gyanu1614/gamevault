'use client'

/**
 * The profile dropdown's content (owner, 2026-09-30: the Seller Dashboard
 * row, the Sell button and the tier line "aren't good, make them perfect").
 *
 *   Seller header: avatar + name + blue VerifiedBadge (→ shop), the tier as a
 *   small chip "🥇 Gold Seller ›" (→ /account/tiers), then two equal actions:
 *   Sell (the one green CTA in the menu) and View Shop.
 *   Rows: one row style for everything. Offers always shows what's under it, so
 *   a new seller sees they can sell items, accounts and currency (owner,
 *   2026-11-06, who also took the balance, the store pause, Feedback and Seller
 *   Dashboard out of this menu: the pause lives in Settings, the rest in the
 *   sidebar). Messages shows the unread count.
 *   Buyer header: avatar + username + Rookie chip + member-since line.
 *
 * The unread count lives in the Navbar, which passes it in.
 */

import Link from '@/components/navigation/AppLink'
import {
  SquaresFourIcon,
  PackageIcon,
  TagIcon,
  WalletIcon,
  ChatTextIcon,
  GearSixIcon,
  LifebuoyIcon,
  SignOutIcon,
  ShieldCheckIcon,
  PlusIcon,
  StorefrontIcon,
  CaretRightIcon,
  SparkleIcon,
  HourglassMediumIcon,
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
  unreadMessages: number
  /** Orders not completed yet: a blue marker on the Orders row. */
  pendingOrders?: number
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
  icon: typeof PackageIcon
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

/** Under Offers, lined up with its label: the row's padding, icon and gap. */
function SubRow({ href, label, onNavigate }: { href: string; label: string; onNavigate: () => void }) {
  return (
    <Link href={href} onClick={onNavigate} className={cn(navMenuRowCls, 'h-9 pl-[42px] text-[13px]')}>
      <span className="truncate">{label}</span>
    </Link>
  )
}

function UnreadCount({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white/[0.09] px-1.5 text-[11.5px] font-semibold tabular-nums text-text-primary">
      {count > 99 ? '99+' : count}
    </span>
  )
}

function PendingOrders({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span aria-label={`${count} pending`} className="ml-auto inline-flex h-5 items-center gap-1 rounded-full bg-[rgba(106,168,255,0.16)] px-1.5 text-[12px] font-semibold tabular-nums text-[#6AA8FF]">
      <HourglassMediumIcon size={12} weight="fill" aria-hidden />
      {count > 99 ? '99+' : count}
    </span>
  )
}

function Avatar({ user, className }: { user: any; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={getAvatarUrl(user.profile?.avatar_url, user.profile?.username || 'user')}
      alt={`${user.profile?.username || 'User'} avatar`}
      aria-hidden
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

export function ProfileMenu({
  user,
  isAdmin,
  unreadMessages,
  pendingOrders = 0,
  onNavigate,
  onLogout,
}: ProfileMenuProps) {
  const isSeller = Boolean(user.isApprovedSeller)

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
            <Row href="/account/orders" icon={PackageIcon} label="Orders" onNavigate={onNavigate} trailing={<PendingOrders count={pendingOrders} />} />
            <Row href="/account/listings?type=items" icon={TagIcon} label="Offers" onNavigate={onNavigate} />
            <SubRow href="/account/listings?type=items" label="Items" onNavigate={onNavigate} />
            <SubRow href="/account/listings?type=accounts" label="Accounts" onNavigate={onNavigate} />
            <SubRow href="/account/listings?type=currency" label="Currency" onNavigate={onNavigate} />
            <Row href="/account/wallet" icon={WalletIcon} label="Wallet" onNavigate={onNavigate} />
            <NavMenuDivider />
            <Row
              href="/account/messages"
              icon={ChatTextIcon}
              label="Messages"
              onNavigate={onNavigate}
              trailing={<UnreadCount count={unreadMessages} />}
            />
            <Row href="/account/settings" icon={GearSixIcon} label="Settings" onNavigate={onNavigate} />
            <Row href="/support" icon={LifebuoyIcon} label="Support" onNavigate={onNavigate} />
          </>
        ) : (
          <>
            <Row href="/account/dashboard" icon={SquaresFourIcon} label="Dashboard" onNavigate={onNavigate} />
            <BecomeSellerCta variant="menu" onNavigate={onNavigate} />
            <NavMenuDivider />
            <Row href="/account/orders" icon={PackageIcon} label="Orders" onNavigate={onNavigate} trailing={<PendingOrders count={pendingOrders} />} />
            <Row href="/account/wallet" icon={WalletIcon} label="Wallet" onNavigate={onNavigate} />
            <NavMenuDivider />
            <Row
              href="/account/messages"
              icon={ChatTextIcon}
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
