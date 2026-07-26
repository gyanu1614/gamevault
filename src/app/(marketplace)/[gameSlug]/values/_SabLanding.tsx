'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useCallback, useEffect, useState } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Search,
  Store,
  TrendingUp,
  User,
} from 'lucide-react'
import ItemCard from '../[categorySlug]/_ItemCard'
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
          <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border-default bg-bg-overlay shadow-elevated sm:h-[68px] sm:w-[68px]">
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
      <CarouselSection
        title="Top Selling Items"
        seeAllHref="/steal-a-brainrot/buy-items"
        offers={itemOffers}
        gameSlug={gameSlug}
        empty={{
          icon: <Store className="h-5 w-5" />,
          title: 'No items listed yet',
          body: 'Item listings will appear here as sellers go live.',
        }}
      />

      {/* ── Top Selling Accounts ─────────────────────────────────────── */}
      <CarouselSection
        title="Top Selling Accounts"
        seeAllHref="/steal-a-brainrot/accounts"
        offers={accountOffers}
        gameSlug={gameSlug}
        empty={{
          icon: <User className="h-5 w-5" />,
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

/* ─── Carousel section (embla + < > arrows beside See all) ─────────────── */

function CarouselSection({
  title,
  seeAllHref,
  offers,
  gameSlug,
  empty,
}: {
  title: string
  seeAllHref: string
  offers: ItemOffer[]
  gameSlug: string
  empty: {
    icon: React.ReactNode
    title: string
    body: string
    cta?: { label: string; href: string }
  }
}) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    dragFree: true,
    containScroll: 'trimSnaps',
  })
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(false)

  const onSelect = useCallback(() => {
    if (!emblaApi) return
    setCanPrev(emblaApi.canScrollPrev())
    setCanNext(emblaApi.canScrollNext())
  }, [emblaApi])

  useEffect(() => {
    if (!emblaApi) return
    onSelect()
    emblaApi.on('select', onSelect).on('reInit', onSelect)
    return () => {
      emblaApi.off('select', onSelect).off('reInit', onSelect)
    }
  }, [emblaApi, onSelect])

  const hasOffers = offers.length > 0

  return (
    <section className="mt-12">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-text-primary sm:text-2xl">{title}</h2>

        <div className="flex items-center gap-2">
          {hasOffers && (
            <div className="hidden items-center gap-1.5 sm:flex">
              <CarouselArrow
                dir="prev"
                disabled={!canPrev}
                onClick={() => emblaApi?.scrollPrev()}
              />
              <CarouselArrow
                dir="next"
                disabled={!canNext}
                onClick={() => emblaApi?.scrollNext()}
              />
            </div>
          )}
          <Link
            href={seeAllHref}
            className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-lime-text transition-opacity hover:opacity-80"
          >
            See all
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {hasOffers ? (
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex gap-5">
            {offers.map((offer) => (
              <div
                key={offer.id}
                className="min-w-0 shrink-0 grow-0 basis-[300px] sm:basis-[360px]"
              >
                <ItemCard offer={offer} gameSlug={gameSlug} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border-default bg-bg-raised px-6 py-14 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-lg border border-border-default bg-bg-overlay text-text-secondary">
            {empty.icon}
          </div>
          <h3 className="text-[17px] font-bold text-text-primary">{empty.title}</h3>
          <p className="mt-2 max-w-sm text-[13.5px] leading-relaxed text-text-secondary">
            {empty.body}
          </p>
          {empty.cta && (
            <Link
              href={empty.cta.href}
              className="mt-5 inline-flex h-10 items-center gap-1.5 rounded-lg bg-lime px-4 text-[13.5px] font-bold text-text-inverse transition-opacity hover:opacity-90"
            >
              {empty.cta.label}
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      )}
    </section>
  )
}

function CarouselArrow({
  dir,
  disabled,
  onClick,
}: {
  dir: 'prev' | 'next'
  disabled: boolean
  onClick: () => void
}) {
  const Icon = dir === 'prev' ? ChevronLeft : ChevronRight
  return (
    <button
      type="button"
      aria-label={dir === 'prev' ? 'Previous' : 'Next'}
      onClick={onClick}
      disabled={disabled}
      className="flex h-9 w-9 items-center justify-center rounded-lg border border-border-default bg-bg-overlay text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-35"
    >
      <Icon className="h-4.5 w-4.5" />
    </button>
  )
}

/* ─── Feature preview cards ────────────────────────────────────────────── */

/** Values card — mini live top-values table preview + CTA. */
function ValuesPreviewCard({ topValues }: { topValues: SabTopValue[] }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border-subtle bg-bg-raised transition-colors hover:border-lime-tint-border">
      <div className="flex flex-col gap-3 p-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border-default bg-bg-overlay text-lime-text">
              <TrendingUp className="h-5 w-5" />
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
            className="mt-5 inline-flex w-fit items-center gap-2 rounded-lg border border-border-default bg-bg-overlay px-4 py-2 text-sm font-semibold text-text-primary transition-colors hover:border-lime-tint-border hover:bg-lime-tint-bg/30 hover:text-lime-text"
          >
            Open values
            <ArrowRight className="h-4 w-4" />
          </SwooshLink>
        </div>

        {/* Mini value-table preview (a real slice of the /values UI). */}
        {topValues.length > 0 && (
          <div className="w-full shrink-0 overflow-hidden rounded-lg border border-border-subtle bg-bg-base sm:w-[236px]">
            <div className="border-b border-border-subtle px-3 py-2 text-[10.5px] font-bold uppercase tracking-wider text-text-tertiary">
              Top values
            </div>
            <div className="divide-y divide-border-subtle">
              {topValues.slice(0, 5).map((value) => (
                <div
                  key={value.slug}
                  className="flex items-center justify-between gap-3 px-3 py-2"
                >
                  <span className="truncate text-[12.5px] text-text-primary">
                    {value.name}
                  </span>
                  <span className="shrink-0 font-mono text-[12.5px] font-bold tabular-nums text-lime-text">
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
    <div className="flex flex-col overflow-hidden rounded-lg border border-border-subtle bg-bg-raised transition-colors hover:border-lime-tint-border">
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
            className="mt-5 inline-flex w-fit items-center gap-2 rounded-lg border border-border-default bg-bg-overlay px-4 py-2 text-sm font-semibold text-text-primary transition-colors hover:border-lime-tint-border hover:bg-lime-tint-bg/30 hover:text-lime-text"
          >
            Open calculator
            <ArrowRight className="h-4 w-4" />
          </SwooshLink>
        </div>

        {/* Mini calculator UI preview. */}
        <div className="w-full shrink-0 overflow-hidden rounded-lg border border-border-subtle bg-bg-base p-3 sm:w-[236px]">
          {/* tab row */}
          <div className="mb-2.5 flex gap-1 rounded-md border border-border-subtle bg-bg-overlay p-1">
            <span className="flex-1 rounded bg-lime px-2 py-1 text-center text-[10.5px] font-bold text-text-inverse">
              Cash
            </span>
            <span className="flex-1 px-2 py-1 text-center text-[10.5px] font-semibold text-text-tertiary">
              Trade
            </span>
          </div>
          {/* fake search */}
          <div className="mb-2.5 flex items-center gap-1.5 rounded-md border border-border-subtle bg-bg-overlay px-2 py-1.5 text-[10.5px] text-text-tertiary">
            <Search className="h-3 w-3" />
            Search a Brainrot…
          </div>
          {/* result row */}
          <div className="flex items-center justify-between rounded-md border border-lime-tint-border bg-lime-tint-bg/25 px-2.5 py-2">
            <span className="text-[11px] font-semibold text-text-primary">Neon · La Vacca</span>
            <span className="font-mono text-[12px] font-bold tabular-nums text-lime-text">
              $42.00
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

