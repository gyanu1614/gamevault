'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Heart } from 'lucide-react'
import { useCarouselStore } from '../hooks/useCarouselStore'
import type { HeroSlide } from '../hooks/useHeroSlides'

export interface HeroCarouselProps {
  slides: HeroSlide[]
  /** Rotation interval in ms. Defaults to 6000 (6s). */
  intervalMs?: number
}

const BADGE_TONE_CLASSES: Record<NonNullable<HeroSlide['badgeTone']>, string> = {
  error:   'bg-error-bg text-error border-error/[0.26]',
  success: 'bg-success-bg text-success border-success/[0.26]',
  info:    'bg-info-bg text-info border-info/[0.26]',
}

/**
 * Hero carousel — 3 rotating slides, 6s rotation, pause on hover,
 * dot navigation with aria-current. Index lives in a Zustand store
 * (see useCarouselStore for rationale).
 */
export function HeroCarousel({ slides, intervalMs = 6000 }: HeroCarouselProps) {
  const activeIndex = useCarouselStore((s) => s.activeIndex)
  const isPaused = useCarouselStore((s) => s.isPaused)
  const setActiveIndex = useCarouselStore((s) => s.setActiveIndex)
  const setPaused = useCarouselStore((s) => s.setPaused)
  const next = useCarouselStore((s) => s.next)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (slides.length <= 1) return
    if (isPaused) {
      if (timerRef.current) clearInterval(timerRef.current)
      return
    }
    timerRef.current = setInterval(() => next(slides.length), intervalMs)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isPaused, slides.length, intervalMs, next])

  // Reset to a valid index if the slide count shrinks
  useEffect(() => {
    if (activeIndex >= slides.length && slides.length > 0) {
      setActiveIndex(0)
    }
  }, [activeIndex, slides.length, setActiveIndex])

  if (slides.length === 0) return null

  return (
    <div
      className="max-w-[1120px] w-full mx-auto flex-1 min-h-0 flex flex-col"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Spotlight banner — fills remaining height */}
      <div className="flex-1 min-h-0 overflow-hidden rounded-xl border border-border-default bg-bg-raised shadow-elevated relative">
        {slides.map((slide, index) => (
          <div
            key={slide.id}
            className="h-full relative"
            style={{ display: index === activeIndex ? 'block' : 'none' }}
            aria-hidden={index !== activeIndex}
          >
            <div className="h-full overflow-hidden relative">
              {/* ASSET: hero carousel banner — game-specific artwork, 1120×400 recommended */}
              <Image
                src={slide.imageSrc}
                alt={slide.imageAlt}
                fill
                priority={index === 0}
                className="w-full h-full object-cover"
              />
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-bg-base/[0.92] via-bg-base/[0.1] to-transparent" />

              {/* Badge */}
              {slide.badge && (
                <div className="absolute top-[14px] left-[14px] z-10">
                  <span
                    className={`inline-flex items-center gap-[5px] h-[22px] px-2 font-body font-semibold text-[11px] tracking-wide rounded-sm border ${BADGE_TONE_CLASSES[slide.badgeTone ?? 'info']}`}
                  >
                    {slide.badge}
                  </span>
                </div>
              )}

              {/* CLICK: toggles favorite state */}
              <button
                className="absolute top-[14px] right-[14px] z-10 w-8 h-8 rounded-sm bg-bg-base/[0.55] backdrop-blur-md border border-border-default grid place-items-center text-text-secondary hover:text-lime hover:border-lime-tint-border transition-all"
                aria-label="Add to favorites"
              >
                <Heart aria-hidden="true" className="w-[18px] h-[18px]" />
              </button>

              {/* Overlay content */}
              <div className="absolute left-0 right-0 bottom-0 z-10 p-10 flex items-end justify-end gap-8">
                {/* CLICK: navigates to slide CTA href */}
                <Link
                  href={slide.ctaHref}
                  className="flex-none inline-flex items-center justify-center gap-2 h-[54px] px-8 bg-lime text-text-inverse font-semibold text-[17px] rounded-lg hover:bg-lime-hover hover:shadow-glow active:bg-lime-pressed transition-all duration-fast ease-gv"
                >
                  <ArrowRight aria-hidden="true" className="w-5 h-5" />
                  {slide.ctaLabel}
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Carousel dots */}
      <div className="flex gap-2 justify-center py-3 flex-none">
        {slides.map((slide, index) => (
          <button
            key={slide.id}
            onClick={() => setActiveIndex(index)}
            aria-label={`Slide ${index + 1}`}
            aria-current={index === activeIndex}
            className={`h-[5px] rounded-full border-none cursor-pointer transition-colors ${
              index === activeIndex
                ? 'w-10 bg-lime'
                : 'w-7 bg-border-strong hover:bg-text-tertiary'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
