/**
 * Seller detail header: identity, tier / status badges, last-active time and
 * the View Shop / View Application links.
 */

import Link from '@/components/navigation/AppLink'
import { ArrowSquareOut } from '@phosphor-icons/react/dist/csr/ArrowSquareOut'
import { CaretLeft } from '@phosphor-icons/react/dist/csr/CaretLeft'
import { cn } from '@/lib/utils'
import type { SellerDetail } from '@/lib/actions/admin-seller-detail'
import { getAvatarUrl } from '@/lib/utils/avatar'
import { StatusBadge, adminBtn } from '../../components/kit'
import { TierChip } from '../../components/TierChip'
import { FLAG, fmtDate, relativeTime, statusTone, titleCase } from './seller-detail-format'

export function SellerDetailHeader({
  profile,
  presence,
  application,
  shopName,
  now,
}: {
  profile: SellerDetail['profile']
  presence: SellerDetail['presence']
  application: SellerDetail['application']
  shopName: string
  now: number | null
}) {
  return (
    <div>
      <Link
        href="/admin/active-sellers"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-text-secondary transition-colors hover:text-text-primary"
      >
        <CaretLeft aria-hidden weight="bold" className="h-3.5 w-3.5" />
        Active Sellers
      </Link>

      <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={getAvatarUrl(profile.avatar_url, profile.username || profile.email || 'seller')}
            alt=""
            className="h-16 w-16 shrink-0 rounded-lg object-cover sm:h-[72px] sm:w-[72px]"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="min-w-0 break-words text-[24px] font-bold leading-tight tracking-tight text-text-primary sm:text-[28px]">
                {shopName}
              </h1>
              <TierChip tier={profile.seller_tier} />
              {profile.is_verified ? (
                <span className={cn(FLAG, 'bg-success-bg text-success')}>Verified</span>
              ) : (
                <span className={cn(FLAG, 'bg-info-bg text-info')} title="Open signup: not identity-verified yet (no withdrawals until verified)">New Seller</span>
              )}
              {profile.kyc_status && (
                <StatusBadge status={`KYC ${titleCase(profile.kyc_status)}`} tone={statusTone(profile.kyc_status)} />
              )}
              {profile.seller_status === 'restricted' && <span className={cn(FLAG, 'bg-error-bg text-error')}>Restricted</span>}
              {profile.seller_status === 'banned' && <span className={cn(FLAG, 'bg-error-bg text-error')}>Banned</span>}
              {presence.store_paused && <span className={cn(FLAG, 'bg-warning-bg text-warning')}>Paused</span>}
              {profile.founding_seller && <span className={cn(FLAG, 'bg-success-bg text-success')}>Founding</span>}
              {profile.is_test && <span className={cn(FLAG, 'bg-white/[0.07] text-text-secondary')}>Test</span>}
            </div>
            <p className="mt-1 break-words text-[13px] text-text-secondary">
              @{profile.username || 'unknown'}
              {profile.email && <> · {profile.email}</>}
            </p>
            <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-text-tertiary">
              <span>
                Joined <span className="font-medium text-text-secondary">{fmtDate(profile.created_at)}</span>
              </span>
              {presence.last_active_at && now != null && (
                <span>
                  Last active <span className="font-medium text-text-secondary">{relativeTime(presence.last_active_at, now)}</span>
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {profile.shop_slug && (
            <Link href={`/shop/${profile.shop_slug}`} target="_blank" className={adminBtn.secondary}>
              <ArrowSquareOut aria-hidden weight="bold" className="h-4 w-4" />
              View Shop
            </Link>
          )}
          {application && (
            <Link href={`/admin/sellers/${application.id}`} className={adminBtn.secondary}>
              View Application
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
