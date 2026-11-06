'use client'

/**
 * {Game} Guides carousel (owner, 2026-10-23: one swipe slides to the next
 * guide, with nice motion). Embla, centred, the neighbours peeking in; as it
 * scrolls the side slides fade back and each cover drifts against its frame
 * (Embla's opacity + parallax tween examples). The tween writes styles
 * straight to the slide nodes on Embla's own scroll event, so no React render
 * per frame, and it is skipped under reduced motion. Every slide is a real
 * link in the server HTML.
 */
import { useCallback, useEffect, useRef } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import { ArrowRightIcon } from '@phosphor-icons/react'
import Link from '@/components/navigation/AppLink'
import { cn } from '@/lib/utils'
import type { GuideCard } from '../types'
import { useRailNav } from './rail.client'
import { pictureUrl } from '@/lib/images/picture-url'

const OPACITY_FLOOR = 0.45
const PARALLAX = 0.18

export function GuidesCarousel({ posts }: { posts: GuideCard[] }) {
  const [ref, api] = useEmblaCarousel({ align: 'center', loop: posts.length > 2, skipSnaps: false })
  const { selected } = useRailNav(api)
  const slides = useRef<HTMLElement[]>([])
  const covers = useRef<HTMLElement[]>([])

  const tween = useCallback(() => {
    if (!api) return
    const progress = api.scrollProgress()
    const snaps = api.scrollSnapList()
    snaps.forEach((snap, i) => {
      let diff = snap - progress
      // Looping: measure to the nearest copy of the snap.
      if (api.internalEngine().options.loop) {
        if (diff > 0.5) diff -= 1
        if (diff < -0.5) diff += 1
      }
      const distance = Math.min(Math.abs(diff * snaps.length), 1)
      const slide = slides.current[i]
      const cover = covers.current[i]
      if (slide) slide.style.opacity = String(1 - distance * (1 - OPACITY_FLOOR))
      if (cover) cover.style.transform = `translateX(${diff * -100 * PARALLAX}%) scale(1.12)`
    })
  }, [api])

  useEffect(() => {
    if (!api) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    tween()
    api.on('scroll', tween).on('reInit', tween)
    return () => {
      api.off('scroll', tween).off('reInit', tween)
    }
  }, [api, tween])

  return (
    <div className="relative mt-8">
      <div className="-mx-4 overflow-hidden sm:-mx-6 lg:mx-0" ref={ref}>
        <div className="flex touch-pan-y">
          {posts.map((post, i) => (
            <div key={post.href} className="min-w-0 shrink-0 grow-0 basis-[86%] pl-3 sm:basis-[68%] sm:pl-5 lg:basis-[62%]">
              <Link
                href={post.href}
                ref={(el) => {
                  if (el) slides.current[i] = el
                }}
                className="group relative block aspect-[4/3] overflow-hidden rounded-lg bg-[#1D1E23] sm:aspect-[16/9]"
              >
                {post.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    ref={(el) => {
                      if (el) covers.current[i] = el
                    }}
                    src={pictureUrl(post.cover, 'big')}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 h-full w-full scale-[1.12] object-cover"
                  />
                ) : (
                  <span aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(125,180,255,0.25),transparent_60%),#1D1E23]" />
                )}
                <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-[#0F1012] via-[#0F1012]/55 to-transparent" />
                <span className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
                  <span className="text-[12.5px] font-bold" style={{ color: post.accent }}>
                    {post.typeLabel}
                  </span>
                  <span className="mt-1.5 block text-balance text-[20px] font-extrabold leading-tight tracking-[-0.02em] text-white sm:text-[28px]">
                    {post.title}
                  </span>
                  <span className="mt-2 hidden max-w-xl text-[14.5px] leading-relaxed text-text-primary sm:line-clamp-1">{post.excerpt}</span>
                  <span className="mt-3 flex items-center gap-3 text-[13px] font-semibold text-text-primary">
                    <span className="inline-flex items-center gap-1.5 text-white group-hover:underline group-hover:underline-offset-4">
                      Read Guide
                      <ArrowRightIcon size={13} weight="bold" aria-hidden className="transition-transform group-hover:translate-x-0.5" />
                    </span>
                    <span className="text-text-tertiary">{post.readMinutes}&nbsp;min read</span>
                  </span>
                </span>
              </Link>
            </div>
          ))}
        </div>
      </div>

      {posts.length > 1 && (
        <div className="mt-5 flex items-center justify-center">
          <div className="flex justify-center gap-2" role="group" aria-label="Choose a guide">
            {posts.map((post, i) => (
              <button
                key={post.href}
                type="button"
                aria-current={i === selected ? 'true' : undefined}
                aria-label={`Guide ${i + 1}: ${post.title}`}
                onClick={() => api?.scrollTo(i)}
                className={cn(
                  'h-1.5 rounded-full transition-[width,background-color] duration-300',
                  i === selected ? 'w-6 bg-white/80' : 'w-1.5 bg-white/25 hover:bg-white/40',
                )}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
