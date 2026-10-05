'use client'

/**
 * Storefront header: banner (custom for Silver+, generated art otherwise)
 * with the avatar overlapping its lower edge, then the identity row — name,
 * blue VerifiedBadge, founding badge, rank chip, handle, member since, live
 * presence / paused state — and the primary action.
 *
 * The page HTML is cached (ISR), so everything viewer-specific is decided
 * here in the browser: own shop → "Edit Shop", anyone else → "Message".
 * While auth is loading the Message link is shown (it goes to the protected
 * messages page, which handles sign-in) — CLAUDE.md, Step 7a.
 */

import Link from '@/components/navigation/AppLink'
import { ChatCircleTextIcon } from '@phosphor-icons/react/dist/csr/ChatCircleText'
import { PencilSimpleIcon } from '@phosphor-icons/react/dist/csr/PencilSimple'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { VerifiedBadge } from '@/components/seller/VerifiedBadge'
import FoundingSellerBadge from '@/components/seller/FoundingSellerBadge'
import SellerTierBadge from '@/components/seller/tiers/SellerTierBadge'
import { StoreBannerArt } from '@/components/shop/StoreBannerArt'
import { useAuth } from '@/hooks/use-auth'
import { useSellerOnline } from '@/hooks/use-seller-presence'
import { tierByKey } from '@/lib/seller/tiers'
import { MARKET_CARD } from '@/lib/ui/surfaces'
import { cn } from '@/lib/utils'
import type { ResolvedStoreBanner } from '@/lib/shop/store-banner'

export interface SellerProfileBannerProps {
  sellerId: string
  displayName: string
  username: string
  avatarUrl: string | null
  isVerified: boolean
  isFoundingSeller: boolean
  sellerTier: string | null
  memberSince: string | null
  isPaused: boolean
  banner: ResolvedStoreBanner
}

export default function SellerProfileBanner({
  sellerId,
  displayName,
  username,
  avatarUrl,
  isVerified,
  isFoundingSeller,
  sellerTier,
  memberSince,
  isPaused,
  banner,
}: SellerProfileBannerProps) {
  const tier = tierByKey(sellerTier)
  const { user } = useAuth()
  const isOwnShop = !!user && user.id === sellerId
  // Live presence, read in the browser (null until the first read).
  const online = useSellerOnline(sellerId)

  return (
    <section aria-label={`${displayName}'s shop`} className={cn('overflow-hidden rounded-lg', MARKET_CARD)}>
      <StoreBannerArt
        banner={banner}
        seed={sellerId}
        priority
        // ~3.75:1 like the stored banner, with a floor on phones.
        className="h-[112px] w-full sm:h-auto sm:aspect-[15/4] sm:max-h-[300px]"
      />

      <div className="relative px-4 pb-5 sm:px-6 sm:pb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-5">
          {/* Avatar — overlaps the banner's lower edge. */}
          <div className="relative -mt-11 w-fit shrink-0 sm:-mt-14">
            <div className="h-[84px] w-[84px] overflow-hidden rounded-xl bg-[#24252B] ring-4 ring-[#1F2025] sm:h-28 sm:w-28">
              {avatarUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-3xl font-bold text-text-primary">
                  {displayName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            {online === true && !isPaused && (
              <span
                aria-hidden
                className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-success ring-[3px] ring-[#1F2025] sm:h-[18px] sm:w-[18px]"
              />
            )}
          </div>

          {/* Identity */}
          <div className="min-w-0 flex-1 sm:pb-1">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <h1 className="min-w-0 break-words text-[24px] font-bold leading-tight tracking-[-0.01em] text-text-primary sm:text-[28px]">
                {displayName}
              </h1>
              {isVerified && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-label="Verified seller"
                      className="-m-1.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                    >
                      <VerifiedBadge size={22} titled={false} />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="border-0">Verified by DropMarket</PopoverContent>
                </Popover>
              )}
              {isFoundingSeller && <FoundingSellerBadge size="sm" />}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] text-text-secondary">
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-label={`Rank ${tier.tierNumber}: ${tier.label}`}
                    className={cn(
                      'inline-flex h-7 items-center gap-1.5 rounded-md bg-white/[0.06] pl-1 pr-2.5 text-[13px] font-semibold transition-colors hover:bg-white/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
                      tier.colors.text,
                    )}
                  >
                    <SellerTierBadge tier={tier.key} size={18} float={false} />
                    {tier.label}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="border-0">
                  Rank {tier.tierNumber}: {tier.label}
                </PopoverContent>
              </Popover>
              <span className="truncate">@{username}</span>
              {memberSince && (
                <>
                  <Dot />
                  <span>Member Since {memberSince}</span>
                </>
              )}
              <Presence online={online} paused={isPaused} />
            </div>
          </div>

          {/* Action */}
          <div className="flex shrink-0 sm:pb-1">
            {isOwnShop ? (
              <Link
                href="/account/settings?tab=seller"
                prefetch={false}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-white/[0.08] px-4 text-[14px] font-semibold text-text-primary transition-[background-color,transform] hover:bg-white/[0.12] active:scale-[0.98] sm:h-10 sm:w-auto"
              >
                <PencilSimpleIcon size={16} weight="bold" aria-hidden />
                Edit Shop
              </Link>
            ) : (
              <Link
                href={`/account/messages?seller=${sellerId}`}
                prefetch={false}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-white px-4 text-[14px] font-semibold text-black transition-[background-color,transform] hover:bg-white/90 active:scale-[0.98] sm:h-10 sm:w-auto"
              >
                <ChatCircleTextIcon size={17} weight="bold" aria-hidden />
                Message Seller
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function Dot() {
  return <span aria-hidden className="text-text-disabled">·</span>
}

function Presence({ online, paused }: { online: boolean | null; paused: boolean }) {
  if (paused) {
    return (
      <span className="inline-flex h-6 items-center gap-1.5 rounded-md bg-warning-bg px-2 text-[12px] font-semibold text-warning">
        Store Paused
      </span>
    )
  }
  if (online == null) return null
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[13px]', online ? 'text-success' : 'text-text-tertiary')}>
      <span aria-hidden className={cn('h-2 w-2 rounded-full', online ? 'bg-success' : 'bg-text-disabled')} />
      {online ? 'Online' : 'Offline'}
    </span>
  )
}
