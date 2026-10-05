'use client'

import Link from '@/components/navigation/AppLink'
import Image from 'next/image'
import { ArrowRightIcon } from '@phosphor-icons/react/dist/csr/ArrowRight'
import { MagnifyingGlassIcon } from '@phosphor-icons/react/dist/csr/MagnifyingGlass'
import { StorefrontIcon } from '@phosphor-icons/react/dist/csr/Storefront'
import { TrendUpIcon } from '@phosphor-icons/react/dist/csr/TrendUp'
import { UserIcon } from '@phosphor-icons/react/dist/csr/User'
import { VALUE_BTN_SECONDARY, VALUE_LABEL, VALUE_SURFACE } from '@/components/values/styles'
import { OfferRail } from '@/components/marketplace/OfferRail'
import type { ItemOffer } from '../[categorySlug]/_itemsTypes'
import type { SabTopValue } from '../page'
import { SwooshLink } from './_SwooshLink'

/** Local price formatter for the stat row + value peek (no server-only imports). */
function formatUsd(price: number | null | undefined): string | null {
  if (price == null || !Number.isFinite(price) || price <= 0) return null
  return `$${Number.isInteger(price) ? price.toFixed(0) : price.toFixed(2)}`
}

export type SabLandingProps = {
  gameSlug: string
  gameName: string
  gameImageUrl?: string | null
  listingCount: number
  minPriceUsd: number | null
  topValues: SabTopValue[]
  itemOffers: ItemOffer[]
  accountOffers: ItemOffer[]
}

/**
 * Steal a Brainrot landing — a standard MARKETPLACE overview page (global
 * navbar + GameSubNav pill above it). Floating centered hero + Top Selling
 * Items / Accounts carousels (real marketplace ItemCard) + two feature cards
 * that preview the Values / Calculator hub.
 */
export function SabLanding({
  gameSlug,
  gameName,
  gameImageUrl,
  topValues,
  itemOffers,
  accountOffers,
}: SabLandingProps) {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
      {/* ── Hero header — floating, left-aligned game lockup (GameBoost-style) ── */}
      <div className="relative flex items-center gap-4 pt-9 sm:gap-5 sm:pt-11">
        {gameImageUrl && (
          <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/[0.05] shadow-elevated sm:h-[68px] sm:w-[68px]">
            <Image
              src={gameImageUrl}
              alt={gameName}
              width={68}
              height={68}
              className="h-full w-full object-contain p-1.5"
            />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="text-[26px] font-bold leading-tight tracking-tight text-text-primary sm:text-[38px]">
            {gameName}
          </h1>
          <p className="mt-1.5 max-w-xl text-[13.5px] leading-relaxed text-text-secondary sm:text-sm">
            Buy pets, secrets and accounts from trusted sellers — delivered in
            minutes and backed by SafeDrop.
          </p>
        </div>
      </div>

      {/* ── Top Selling Items ────────────────────────────────────────── */}
      <OfferRail
        title="Top Selling Items"
        seeAllHref="/steal-a-brainrot/buy-items"
        offers={itemOffers}
        gameSlug={gameSlug}
        gameName={gameName}
        empty={{
          icon: <StorefrontIcon size={20} weight="bold" />,
          title: 'No items listed yet',
          body: 'Item listings will appear here as sellers go live.',
        }}
      />

      {/* ── Top Selling Accounts ─────────────────────────────────────── */}
      <OfferRail
        title="Top Selling Accounts"
        seeAllHref="/steal-a-brainrot/accounts"
        offers={accountOffers}
        gameSlug={gameSlug}
        gameName={gameName}
        empty={{
          icon: <UserIcon size={20} weight="bold" />,
          title: 'No accounts listed yet',
          body: 'Be the first to sell a Steal a Brainrot account.',
          cta: { label: 'Become a Founding Seller', href: '/early-seller' },
        }}
      />

      {/* ── Feature cards — Values peek + Calculator preview ─────────── */}
      <section className="mt-14 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ValuesPreviewCard topValues={topValues} />
        <CalculatorPreviewCard />
      </section>
    </div>
  )
}

function ValuesPreviewCard({ topValues }: { topValues: SabTopValue[] }) {
  return (
    <div className={`flex flex-col overflow-hidden ${VALUE_SURFACE}`}>
      <div className="flex flex-col gap-3 p-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-text-secondary">
              <TrendUpIcon size={20} weight="bold" />
            </span>
            <h2 className="text-lg font-bold text-text-primary">Brainrot Values</h2>
          </div>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-text-secondary">
            Live cash values for every Brainrot, rarity, and mutation — updated
            daily from real marketplace sales.
          </p>
          <SwooshLink
            href="/steal-a-brainrot/values"
            to="values"
            className={`mt-5 w-fit ${VALUE_BTN_SECONDARY}`}
          >
            Open Values
            <ArrowRightIcon size={16} weight="bold" aria-hidden />
          </SwooshLink>
        </div>

        {/* Mini value-table preview (a real slice of the /values UI). */}
        {topValues.length > 0 && (
          <div className="w-full shrink-0 overflow-hidden rounded-md bg-white/[0.04] sm:w-[236px]">
            <div className={`border-b border-white/[0.07] px-3 py-2 ${VALUE_LABEL}`}>
              Top Values
            </div>
            <div className="divide-y divide-white/[0.07]">
              {topValues.slice(0, 5).map((value) => (
                <div
                  key={value.slug}
                  className="flex items-center justify-between gap-3 px-3 py-2"
                >
                  <span className="truncate text-[12.5px] text-text-primary">
                    {value.name}
                  </span>
                  <span className="shrink-0 text-[12.5px] font-semibold tabular-nums text-lime-text">
                    {formatUsd(value.priceUsd) ?? '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/** Calculator card — mini calculator UI preview (not a black box) + CTA. */
function CalculatorPreviewCard() {
  return (
    <div className={`flex flex-col overflow-hidden ${VALUE_SURFACE}`}>
      <div className="flex flex-col gap-3 p-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-text-primary">Value &amp; Trade Calculator</h2>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-text-secondary">
            Look up any mutation&apos;s cash value, then check whether a full
            trade is a Win, Fair, or Loss.
          </p>
          <SwooshLink
            href="/steal-a-brainrot/calculator"
            to="values"
            className={`mt-5 w-fit ${VALUE_BTN_SECONDARY}`}
          >
            Open Calculator
            <ArrowRightIcon size={16} weight="bold" aria-hidden />
          </SwooshLink>
        </div>

        {/* Mini calculator UI preview. */}
        <div className="w-full shrink-0 overflow-hidden rounded-md bg-white/[0.04] p-3 sm:w-[236px]">
          {/* tab row */}
          <div className="mb-2.5 flex gap-1 rounded-md bg-white/[0.05] p-1">
            <span className="flex-1 rounded bg-lime px-2 py-1 text-center text-[10.5px] font-bold text-text-inverse">
              Cash
            </span>
            <span className="flex-1 px-2 py-1 text-center text-[10.5px] font-semibold text-text-tertiary">
              Trade
            </span>
          </div>
          {/* fake search */}
          <div className="mb-2.5 flex items-center gap-1.5 rounded-md bg-white/[0.05] px-2 py-1.5 text-[10.5px] text-text-tertiary">
            <MagnifyingGlassIcon size={12} weight="bold" aria-hidden />
            Search a Brainrot…
          </div>
          {/* result row */}
          <div className="flex items-center justify-between rounded-md bg-white/[0.06] px-2.5 py-2">
            <span className="text-[11px] font-semibold text-text-primary">Neon · La Vacca</span>
            <span className="text-[12px] font-semibold tabular-nums text-lime-text">
              $42.00
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

