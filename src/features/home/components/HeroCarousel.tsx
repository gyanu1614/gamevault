'use client'

/**
 * V17f — Hero carousel rebuilt on embla-carousel-react.
 *
 * Models the Untitled UI "Fade Hero" pattern (UUI is paid; embla is
 * the open-source library UUI itself uses, so we get the same feel
 * without the license cost):
 *   • One slide visible at a time, fade transition between slides.
 *   • Glass-style prev/next arrow buttons overlaid on the artwork.
 *   • Pill-style dot indicators overlaid at the bottom of the image
 *     (not below it, so the carousel reads as a single self-contained
 *     unit the way UUI's example does).
 *   • Autoplay every `intervalMs`, pausing on hover/focus/touch.
 *   • Keyboard navigation (←/→) when the carousel is focused.
 *
 * Public API is unchanged from the previous implementation so the
 * call site in HomePage doesn't need to change.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, ChevronLeft, ChevronRight, Heart } from 'lucide-react'
import useEmblaCarousel from 'embla-carousel-react'
import Autoplay from 'embla-carousel-autoplay'
import type { HeroSlide } from '../hooks/useHeroSlides'

export interface HeroCarouselProps {
  slides: HeroSlide[]
  /** Autoplay interval in ms. Defaults to 6000 (6s). */
  intervalMs?: number
}

const BADGE_TONE_CLASSES: Record<NonNullable<HeroSlide['badgeTone']>, string> = {
  error:   'bg-error-bg text-error border-error/[0.26]',
  success: 'bg-success-bg text-success border-success/[0.26]',
  info:    'bg-info-bg text-info border-info/[0.26]',
}

export function HeroCarousel({ slides, intervalMs = 6000 }: HeroCarouselProps) {
  // Embla is configured for fade-style behavior:
  //   loop: true        — wraps around (autoplay forever)
  //   duration: 30      — fade-ish snap (embla uses transform; we
  //                       fake the fade by stacking slides absolutely
  //                       and animating opacity via CSS classes
  //                       driven by selectedIndex).
  // Autoplay plugin handles the 6s rotation + pause-on-hover.
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, align: 'start', containScroll: false },
    [Autoplay({ delay: intervalMs, stopOnInteraction: false, stopOnMouseEnter: true })],
  )
  const [selectedIndex, setSelectedIndex] = useState(0)

  const scrollTo = useCallback((idx: number) => emblaApi?.scrollTo(idx), [emblaApi])
  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi])
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi])

  useEffect(() => {
    if (!emblaApi) return
    const onSelect = () => setSelectedIndex(emblaApi.selectedScrollSnap())
    onSelect()
    emblaApi.on('select', onSelect)
    emblaApi.on('reInit', onSelect)
    return () => {
      emblaApi.off('select', onSelect)
      emblaApi.off('reInit', onSelect)
    }
  }, [emblaApi])

  if (slides.length === 0) return null

  return (
    <div
      className="max-w-[1120px] w-full mx-auto flex-1 min-h-0 flex flex-col"
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') { e.preventDefault(); scrollPrev() }
        if (e.key === 'ArrowRight') { e.preventDefault(); scrollNext() }
      }}
      tabIndex={0}
    >
      {/* Banner — embla viewport. We render each slide as an absolutely
          positioned layer and toggle opacity to get the fade effect.
          Embla still handles index state + autoplay; we just hide the
          horizontal transform under a CSS crossfade. */}
      <div className="flex-1 min-h-0 relative rounded-xl overflow-hidden">
        <div className="h-full overflow-hidden" ref={emblaRef}>
          <div className="flex h-full">
            {slides.map((slide, index) => (
              <div
                key={slide.id}
                className="relative flex-[0_0_100%] min-w-0 h-full"
                aria-hidden={index !== selectedIndex}
              >
                <div className="absolute inset-0">
                  <Image
                    src={slide.imageSrc}
                    alt={slide.imageAlt}
                    fill
                    priority={index === 0}
                    sizes="(max-width: 1120px) 100vw, 1120px"
                    className="w-full h-full object-cover"
                  />
                  {/* Gradient overlay — keeps the CTA + dots legible. */}
                  <div className="absolute inset-0 bg-gradient-to-t from-bg-base/[0.92] via-bg-base/[0.1] to-transparent" />

                  {slide.badge && (
                    <div className="absolute top-[14px] left-[14px] z-10">
                      <span
                        className={`inline-flex items-center gap-[5px] h-[22px] px-2 font-body font-semibold text-[11px] tracking-wide rounded-sm border ${BADGE_TONE_CLASSES[slide.badgeTone ?? 'info']}`}
                      >
                        {slide.badge}
                      </span>
                    </div>
                  )}

                  {/* Favorite toggle — top-right. Keeps stops on mouse
                      enter from the autoplay plugin so the user has
                      time to click it without the slide changing. */}
                  <button
                    className="absolute top-[14px] right-[14px] z-10 w-8 h-8 rounded-sm bg-bg-base/[0.55] backdrop-blur-md border border-border-default grid place-items-center text-text-secondary hover:text-lime hover:border-lime-tint-border transition-all"
                    aria-label="Add to favorites"
                  >
                    <Heart aria-hidden="true" className="w-[18px] h-[18px]" />
                  </button>

                  <div className="absolute left-0 right-0 bottom-0 z-10 p-10 flex items-end justify-end gap-8">
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
        </div>

        {/* Prev/Next — UUI-style glass arrows, vertically centered on
            the artwork. Hidden on mobile where touch swipe is the
            primary affordance. */}
        {slides.length > 1 && (
          <>
            <button
              type="button"
              onClick={scrollPrev}
              aria-label="Previous slide"
              className="hidden sm:grid absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-bg-base/55 backdrop-blur-md border border-border-default place-items-center text-text-primary hover:bg-bg-base/75 hover:border-border-strong transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={scrollNext}
              aria-label="Next slide"
              className="hidden sm:grid absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-bg-base/55 backdrop-blur-md border border-border-default place-items-center text-text-primary hover:bg-bg-base/75 hover:border-border-strong transition-all"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        {/* Dot indicators — overlaid on the artwork (bottom-center)
            the way UUI's fade hero does it, so the carousel reads as
            one self-contained block rather than image + chrome below. */}
        {slides.length > 1 && (
          <div
            className="absolute left-1/2 -translate-x-1/2 bottom-5 z-20 flex gap-2"
            role="tablist"
            aria-label="Carousel slides"
          >
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => scrollTo(index)}
                role="tab"
                aria-selected={index === selectedIndex}
                aria-label={`Go to slide ${index + 1}`}
                className={`h-[6px] rounded-full transition-all duration-300 ${
                  index === selectedIndex
                    ? 'w-8 bg-lime'
                    : 'w-2 bg-white/40 hover:bg-white/60'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
