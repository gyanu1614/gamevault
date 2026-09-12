'use client'

/**
 * RankCarousel — the sliding rank rail on /account/tiers.
 *
 * SaaS pricing-slider treatment on Embla (already in the stack):
 *   • center-snapped slides, opens on the seller's CURRENT rank
 *   • drag/swipe with Embla's momentum; arrows + rank-icon pagination
 *   • distance tween: off-center cards scale to 0.94 and dim to 0.55,
 *     the centered card sits at full scale/brightness (official Embla
 *     scrollProgress pattern, applied to an inner tween node)
 *   • soft edge fades so the rail melts into the page
 *   • reduced motion ⇒ no tween, all cards full strength
 *
 * Layout contract: the page passes tier configs + current/eligible keys;
 * all card rendering stays in TierCard.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import type { EmblaCarouselType } from 'embla-carousel'
import { useReducedMotion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { tierLabel } from '@/lib/seller/tiers'
import TierCard, { type TierConfig } from './TierCard'
import RankIcon from './RankIcon'

const SCALE_RANGE = 0.06 // centered 1.0 → far 0.94
const OPACITY_RANGE = 0.45 // centered 1.0 → far 0.55

interface RankCarouselProps {
  tiers: TierConfig[]
  currentTier: string
  eligibleTier: string
}

export default function RankCarousel({ tiers, currentTier, eligibleTier }: RankCarouselProps) {
  const reduce = useReducedMotion()
  const startIndex = Math.max(
    0,
    tiers.findIndex((t) => t.tier === currentTier),
  )
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'center',
    containScroll: false,
    startIndex,
    skipSnaps: false,
  })
  const tweenNodes = useRef<HTMLElement[]>([])
  const [selectedIndex, setSelectedIndex] = useState(startIndex)
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(false)

  const collectTweenNodes = useCallback((api: EmblaCarouselType) => {
    tweenNodes.current = api
      .slideNodes()
      .map((slide) => slide.querySelector('[data-tween]') as HTMLElement)
  }, [])

  // Distance tween — runs on every scroll frame, off the React render cycle.
  const tween = useCallback(
    (api: EmblaCarouselType) => {
      const progress = api.scrollProgress()
      api.scrollSnapList().forEach((snap, i) => {
        const node = tweenNodes.current[i]
        if (!node) return
        const dist = Math.abs(snap - progress)
        // Normalize: one snap step apart ≈ full effect.
        const step = api.scrollSnapList().length > 1 ? Math.abs(api.scrollSnapList()[1] - api.scrollSnapList()[0]) : 1
        const t = Math.min(dist / (step || 1), 1)
        node.style.transform = `scale(${1 - SCALE_RANGE * t})`
        node.style.opacity = String(1 - OPACITY_RANGE * t)
      })
    },
    [],
  )

  const onSelect = useCallback((api: EmblaCarouselType) => {
    setSelectedIndex(api.selectedScrollSnap())
    setCanPrev(api.canScrollPrev())
    setCanNext(api.canScrollNext())
  }, [])

  useEffect(() => {
    if (!emblaApi) return
    collectTweenNodes(emblaApi)
    onSelect(emblaApi)
    if (!reduce) {
      tween(emblaApi)
      emblaApi.on('scroll', tween).on('reInit', tween)
    }
    emblaApi.on('select', onSelect).on('reInit', onSelect).on('reInit', collectTweenNodes)
    return () => {
      emblaApi.off('scroll', tween).off('reInit', tween)
      emblaApi.off('select', onSelect).off('reInit', onSelect).off('reInit', collectTweenNodes)
    }
  }, [emblaApi, reduce, tween, onSelect, collectTweenNodes])

  return (
    <div className="relative">
      {/* ── Rail ─────────────────────────────────────────────────────────── */}
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex touch-pan-y">
          {tiers.map((tier, i) => (
            <div
              key={tier.tier}
              className="min-w-0 shrink-0 grow-0 basis-[86%] pl-4 first:pl-0 sm:basis-[380px] lg:basis-[420px]"
            >
              <div
                data-tween
                className="h-full will-change-transform"
                style={reduce ? undefined : { transition: 'none' }}
              >
                <TierCard
                  config={tier}
                  index={i}
                  isCurrent={tier.tier === currentTier}
                  isEligible={tier.tier === eligibleTier && tier.tier !== currentTier}
                  className="h-full"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Edge fades ───────────────────────────────────────────────────── */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-[#0a0a0f]/80 to-transparent sm:w-24"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[#0a0a0f]/80 to-transparent sm:w-24"
      />

      {/* ── Controls: rank pagination left, arrows right ─────────────────── */}
      <div className="mt-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-1.5">
          {tiers.map((tier, i) => (
            <button
              key={tier.tier}
              type="button"
              aria-label={`Go to ${tierLabel(tier.tier)}`}
              onClick={() => emblaApi?.scrollTo(i)}
              className={cn(
                'flex items-center gap-1.5 rounded-md border px-2 py-1.5 transition-colors',
                i === selectedIndex
                  ? 'border-lime/35 bg-lime/[0.08]'
                  : 'border-transparent hover:border-white/[0.12] hover:bg-white/[0.04]',
              )}
            >
              <RankIcon tier={tier.tier} size={16} />
              <span
                className={cn(
                  'text-[11px] font-semibold',
                  i === selectedIndex ? 'text-white' : 'text-zinc-500',
                )}
              >
                {tierLabel(tier.tier)}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <ArrowButton
            direction="prev"
            disabled={!canPrev}
            onClick={() => emblaApi?.scrollPrev()}
          />
          <ArrowButton
            direction="next"
            disabled={!canNext}
            onClick={() => emblaApi?.scrollNext()}
          />
        </div>
      </div>
    </div>
  )
}

/* ── Arrow control (rectangular, checkout language) ───────────────────────── */

function ArrowButton({
  direction,
  disabled,
  onClick,
}: {
  direction: 'prev' | 'next'
  disabled: boolean
  onClick: () => void
}) {
  const Icon = direction === 'prev' ? ChevronLeft : ChevronRight
  return (
    <button
      type="button"
      aria-label={direction === 'prev' ? 'Previous rank' : 'Next rank'}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'grid h-8 w-8 place-items-center rounded-md border border-border-subtle bg-white/[0.04] text-zinc-300',
        'transition-colors hover:border-white/[0.2] hover:bg-white/[0.08] hover:text-white',
        'active:translate-y-px disabled:pointer-events-none disabled:opacity-35',
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  )
}
