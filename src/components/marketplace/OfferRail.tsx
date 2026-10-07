'use client'

/**
 * OfferRail — a titled row of item/account offers (the real ItemCard) that
 * scrolls sideways: Embla drag on touch and trackpad, prev/next buttons on
 * desktop, "See All" to the category. Used by the game hubs (every game) and
 * the Steal a Brainrot landing, so both read as one family.
 *
 * The best offer (cheapest in stock) carries its flag; the viewer's own
 * offers show "Yours" (personalisation stays client-side on static pages).
 * Fill-only controls, neutral See All (card-surface system).
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from '@/components/navigation/AppLink'
import useEmblaCarousel from 'embla-carousel-react'
import { ArrowRightIcon, CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react'
import ItemCard from '@/app/(marketplace)/[gameSlug]/[categorySlug]/_ItemCard'
import { bestOfferId } from '@/app/(marketplace)/[gameSlug]/[categorySlug]/_itemsSort'
import type { ItemOffer } from '@/app/(marketplace)/[gameSlug]/[categorySlug]/_itemsTypes'
import { useAuth } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'

interface OfferRailProps {
  title: string
  seeAllHref: string
  offers: ItemOffer[]
  gameSlug: string
  gameName: string
  /** Shown instead of the row when there are no offers; omit to render nothing. */
  empty?: {
    icon: ReactNode
    title: string
    body: string
    cta?: { label: string; href: string }
  }
  className?: string
}

function Arrow({ dir, disabled, onClick }: { dir: 'prev' | 'next'; disabled: boolean; onClick: () => void }) {
  const Icon = dir === 'prev' ? CaretLeftIcon : CaretRightIcon
  return (
    <button
      type="button"
      aria-label={dir === 'prev' ? 'Previous offers' : 'Next offers'}
      onClick={onClick}
      disabled={disabled}
      className="grid h-9 w-9 place-items-center rounded-md bg-white/[0.06] text-text-secondary transition-[background-color,color,transform] hover:bg-white/[0.1] hover:text-text-primary active:scale-95 disabled:pointer-events-none disabled:opacity-35"
    >
      <Icon size={15} weight="bold" aria-hidden />
    </button>
  )
}

export function OfferRail({ title, seeAllHref, offers, gameSlug, gameName, empty, className }: OfferRailProps) {
  const { user } = useAuth()
  const [emblaRef, emblaApi] = useEmblaCarousel({ align: 'start', dragFree: true, containScroll: 'trimSnaps' })
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(false)
  const best = useMemo(() => bestOfferId(offers), [offers])

  const onSelect = useCallback(() => {
    if (!emblaApi) return
    setCanPrev(emblaApi.canScrollPrev())
    setCanNext(emblaApi.canScrollNext())
  }, [emblaApi])

  useEffect(() => {
    if (!emblaApi) return
    onSelect()
    emblaApi.on('select', onSelect).on('reInit', onSelect).on('scroll', onSelect)
    return () => {
      emblaApi.off('select', onSelect).off('reInit', onSelect).off('scroll', onSelect)
    }
  }, [emblaApi, onSelect])

  const hasOffers = offers.length > 0
  if (!hasOffers && !empty) return null

  return (
    <section className={cn('mt-12 sm:mt-14', className)}>
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="text-[20px] font-bold tracking-[-0.01em] text-text-primary sm:text-[24px]">{title}</h2>
        <div className="flex items-center gap-2">
          {hasOffers && (canPrev || canNext) && (
            <div className="hidden items-center gap-1.5 sm:flex">
              <Arrow dir="prev" disabled={!canPrev} onClick={() => emblaApi?.scrollPrev()} />
              <Arrow dir="next" disabled={!canNext} onClick={() => emblaApi?.scrollNext()} />
            </div>
          )}
          {/* Floating rectangular "Show All" (owner, 2026-10-06): a raised
              fill + soft drop shadow, no outline. */}
          <Link
            href={seeAllHref}
            className="group inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-[#1D1E23] px-3.5 text-[13.5px] font-semibold text-text-primary shadow-[0_12px_26px_-14px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)] transition-[background-color,transform] hover:-translate-y-px hover:bg-[#24252B] active:translate-y-0"
          >
            Show All
            <ArrowRightIcon size={14} weight="bold" aria-hidden className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>

      {hasOffers ? (
        <div className="-mx-4 overflow-hidden px-4 sm:mx-0 sm:px-0" ref={emblaRef}>
          <div className="flex gap-4 sm:gap-5">
            {offers.map((offer) => (
              <div key={offer.id} className="min-w-0 shrink-0 grow-0 basis-[calc(100%-24px)] sm:basis-[360px]">
                <ItemCard
                  offer={offer}
                  gameSlug={gameSlug}
                  gameName={gameName}
                  isOwn={!!user?.id && offer.sellerId === user.id}
                  isBestDeal={offer.id === best}
                />
              </div>
            ))}
          </div>
        </div>
      ) : (
        empty && (
          <div className="flex flex-col items-center justify-center rounded-lg bg-bg-raised px-6 py-14 text-center">
            <div className="mb-4 grid h-14 w-14 place-items-center rounded-lg bg-white/[0.05] text-text-secondary">{empty.icon}</div>
            <h3 className="text-[17px] font-bold text-text-primary">{empty.title}</h3>
            <p className="mt-2 max-w-sm text-[13.5px] leading-relaxed text-text-secondary">{empty.body}</p>
            {empty.cta && (
              <Link
                href={empty.cta.href}
                className="mt-5 inline-flex h-10 items-center gap-1.5 rounded-md bg-white/[0.08] px-4 text-[14px] font-semibold text-text-primary transition-colors hover:bg-white/[0.12]"
              >
                {empty.cta.label}
                <ArrowRightIcon size={14} weight="bold" aria-hidden />
              </Link>
            )}
          </div>
        )
      )}
    </section>
  )
}
