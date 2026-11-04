'use client'

/**
 * Seller detail, left column: Seller Tier, Listings and Sales sections.
 * State and mutations stay in SellerDetailClient; these get values + callbacks.
 */

import { useMemo } from 'react'
import Link from '@/components/navigation/AppLink'
import { ArrowSquareOut } from '@phosphor-icons/react/dist/csr/ArrowSquareOut'
import { CaretDown } from '@phosphor-icons/react/dist/csr/CaretDown'
import { CaretUp } from '@phosphor-icons/react/dist/csr/CaretUp'
import { cn } from '@/lib/utils'
import type { SellerDetail } from '@/lib/actions/admin-seller-detail'
import { TIER_KEYS } from '@/lib/seller/tiers'
import { money } from '@/lib/seller/format-amount'
import { StatusBadge, adminBtnSm } from '../../components/kit'
import { TierChip } from '../../components/TierChip'
import { Badge, Section } from './SellerDetailParts'
import { INNER_LABEL, ROWS, fmtDate, statusTone, titleCase } from './seller-detail-format'

/** Seller rank ladder, low → high, from the central module. */
const SELLER_TIERS = TIER_KEYS

export function SellerTierSection({
  detail,
  onChangeTier,
}: {
  detail: SellerDetail
  /** Resets the tier form and opens the Change Tier dialog. */
  onChangeTier: () => void
}) {
  const { profile } = detail

  const currentConfig = useMemo(
    () => detail.tier.configs.find((c) => c.tier === profile.seller_tier) ?? null,
    [detail.tier.configs, profile.seller_tier],
  )

  const eligibleHigher = useMemo(() => {
    const info = detail.tier.info
    if (!info || !info.eligible_tier || info.eligible_tier === profile.seller_tier) return null
    const order = (t: string) => SELLER_TIERS.indexOf(t as (typeof SELLER_TIERS)[number])
    return order(info.eligible_tier) > order(profile.seller_tier) ? info.eligible_tier : null
  }, [detail.tier.info, profile.seller_tier])

  return (
    <Section
      title="Seller Tier"
      sub="Sets commission, listing limits and moderation."
      aside={
        <button type="button" onClick={onChangeTier} className={adminBtnSm.secondary}>
          Change Tier
        </button>
      }
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <TierChip tier={profile.seller_tier} className="text-[12.5px]" />
        {currentConfig && (
          <span className="text-[12.5px] text-text-tertiary">
            {currentConfig.discount_pts != null && (
              <>
                Rank discount{' '}
                <span className="font-semibold tabular-nums text-text-secondary">
                  {currentConfig.discount_pts > 0 ? `−${currentConfig.discount_pts} pts` : 'none'}
                </span>
                {' · '}
              </>
            )}
            Listing limit{' '}
            <span className="font-semibold tabular-nums text-text-secondary">
              {currentConfig.listing_limit ?? 'Unlimited'}
            </span>
            {currentConfig.pre_moderation_listings != null && (
              <>
                {' · '}Pre-moderated listings{' '}
                <span className="font-semibold tabular-nums text-text-secondary">
                  {currentConfig.pre_moderation_listings}
                </span>
              </>
            )}
          </span>
        )}
      </div>

      {eligibleHigher && (
        <p className="mt-3 rounded-md bg-success-bg px-3.5 py-2.5 text-[12.5px] text-success">
          Eligible for <span className="font-bold">{titleCase(eligibleHigher)}</span> by the automatic rules —
          consider an upgrade.
        </p>
      )}

      {detail.tier.history.length > 0 && (
        <div className="mt-4">
          <p className={INNER_LABEL}>Recent Tier Changes</p>
          <div className={ROWS}>
            {detail.tier.history.map((h) => (
              <div key={h.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-[12.5px] first:pt-0">
                <span className="font-semibold text-text-primary">
                  {h.previous_tier ? titleCase(h.previous_tier) : '—'} → {titleCase(h.new_tier)}
                </span>
                <span className="text-text-tertiary">{titleCase(h.reason)}</span>
                {h.notes && <span className="italic text-text-tertiary">“{h.notes}”</span>}
                <span className="ml-auto text-text-tertiary">{fmtDate(h.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Section>
  )
}

export function SellerListingsSection({
  detail,
  pendingListings,
  showAllListings,
  onToggleShowAll,
}: {
  detail: SellerDetail
  pendingListings: number
  showAllListings: boolean
  onToggleShowAll: () => void
}) {
  const listings = showAllListings ? detail.listings.recent : detail.listings.recent.slice(0, 5)

  return (
    <Section
      title="Listings"
      sub="Inventory by status, newest first."
      aside={
        pendingListings > 0 ? (
          <Link
            href="/admin/moderation"
            className="inline-flex items-center gap-1 text-[13px] font-semibold text-text-secondary transition-colors hover:text-text-primary"
          >
            Moderation Queue
            <ArrowSquareOut aria-hidden weight="bold" className="h-3.5 w-3.5" />
          </Link>
        ) : undefined
      }
    >
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(detail.listings.countsByStatus)
          .sort(([, a], [, b]) => b - a)
          .map(([status, count]) => (
            <StatusBadge key={status} status={`${titleCase(status)} ${count}`} tone={statusTone(status)} />
          ))}
        {Object.keys(detail.listings.countsByStatus).length === 0 && (
          <p className="text-[13px] text-text-tertiary">No listings yet.</p>
        )}
      </div>

      {detail.listings.recent.length > 0 && (
        <div className={cn(ROWS, 'mt-3')}>
          {listings.map((l) => (
            <div key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
              <p className="min-w-0 basis-full truncate text-[13.5px] font-medium text-text-primary sm:flex-1 sm:basis-auto">{l.title}</p>
              {l.game_name && (
                <span className="rounded-full bg-white/[0.07] px-2 py-0.5 text-[11.5px] font-medium text-text-secondary">
                  {l.game_name}
                </span>
              )}
              <span className="text-[13px] font-semibold tabular-nums text-text-primary">{money(l.price)}</span>
              <Badge status={l.status} />
              <span className="w-[92px] text-right text-[12px] text-text-tertiary">{fmtDate(l.created_at)}</span>
            </div>
          ))}
          {detail.listings.recent.length > 5 && (
            <button
              type="button"
              onClick={onToggleShowAll}
              className="flex w-full items-center justify-center gap-1.5 pt-2.5 text-[13px] font-semibold text-text-secondary transition-colors hover:text-text-primary"
            >
              {showAllListings ? (
                <>
                  <CaretUp aria-hidden weight="bold" className="h-3.5 w-3.5" />
                  Show Less
                </>
              ) : (
                <>
                  <CaretDown aria-hidden weight="bold" className="h-3.5 w-3.5" />
                  Show More ({detail.listings.recent.length - 5})
                </>
              )}
            </button>
          )}
        </div>
      )}
    </Section>
  )
}

export function SellerSalesSection({ detail }: { detail: SellerDetail }) {
  return (
    <Section
      title="Sales"
      sub={`${detail.orders.totalOrders} orders all-time · ${detail.orders.completedCount} completed.`}
    >
      {detail.orders.recent.length === 0 ? (
        <p className="text-[13px] text-text-tertiary">No orders yet.</p>
      ) : (
        <div className={ROWS}>
          {detail.orders.recent.map((o) => (
            <Link
              key={o.id}
              href={`/admin/orders/${o.id}`}
              className="-mx-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md px-2 py-2.5 transition-colors first:pt-0 hover:bg-white/[0.03]"
            >
              <span className="font-mono text-[12.5px] font-semibold text-text-primary">
                {o.order_number || `#${o.id.split('-')[0]}`}
              </span>
              <span className="text-[13px] font-semibold tabular-nums text-text-primary">{money(o.total_amount)}</span>
              <span className="text-[12px] tabular-nums text-text-tertiary">payout {money(o.seller_payout)}</span>
              <span className="ml-auto">
                <Badge status={o.status} />
              </span>
              <span className="w-[92px] text-right text-[12px] text-text-tertiary">{fmtDate(o.created_at)}</span>
            </Link>
          ))}
        </div>
      )}
    </Section>
  )
}
