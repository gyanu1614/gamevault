'use client'

/**
 * "All <game> guides" — an Embla carousel of "4A" blog post cards from the
 * marketplace banner handoff.
 *
 * Card anatomy (top → bottom): cover photo with the headline set as display
 * type over it (side scrim keeps it legible on any art, bottom fade dissolves
 * the photo into the card body — the fade's end stop equals the card bg so
 * there is never a hard line), then chip row, headline, hairline divider and
 * a meta row. Slash strokes + a dot grid detail the cover's right edge.
 *
 * Palette mapped to our forest tokens: card #121613, hairline #1E2723,
 * mint #8FBF9C, on-mint #08110B. Display type is Inter (site font) rather
 * than the handoff's Anton, per the handoff's own "swap the families" rule.
 */

import Link from 'next/link'
import { useCallback } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import AccessTimeIcon from '@mui/icons-material/AccessTime'

export interface ArticleCardData {
  slug: string
  title: string
  excerpt: string
  category: string
  date: string
  cover: string | null
  readMinutes: number
}

export function ArticleGrid({
  gameName,
  gameSlug,
  posts,
}: {
  gameName: string
  gameSlug: string
  posts: ArticleCardData[]
}) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    containScroll: 'trimSnaps',
  })
  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi])
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi])

  if (posts.length === 0) return null

  return (
    <section className="pt-12 sm:pt-16">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[20px] font-semibold tracking-tight text-[#F1F3F1] sm:text-[24px]">
          All {gameName} guides
        </h2>
        <div className="flex items-center gap-2.5">
          <span className="hidden font-mono text-[11px] text-[#5E685E] sm:inline">
            {posts.length} {posts.length === 1 ? 'GUIDE' : 'GUIDES'}
          </span>
          <button
            type="button"
            onClick={scrollPrev}
            aria-label="Previous guides"
            className="flex h-9 w-9 items-center justify-center border border-[#26332C] text-[#9BA8A0] transition hover:border-[#3FA35C] hover:text-[#F1F3F1]"
          >
            <ChevronLeftIcon sx={{ fontSize: 18 }} />
          </button>
          <button
            type="button"
            onClick={scrollNext}
            aria-label="Next guides"
            className="flex h-9 w-9 items-center justify-center border border-[#26332C] text-[#9BA8A0] transition hover:border-[#3FA35C] hover:text-[#F1F3F1]"
          >
            <ChevronRightIcon sx={{ fontSize: 18 }} />
          </button>
        </div>
      </div>

      <div ref={emblaRef} className="overflow-hidden">
        <div className="flex gap-4">
          {posts.map((post) => (
            <GuideCard key={post.slug} gameSlug={gameSlug} post={post} />
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── 4A blog post card ──────────────────────────────────────────────────── */

/** Exported so the admin editor can render a live, pixel-identical preview. */
export function GuideCard({
  gameSlug,
  post,
}: {
  gameSlug: string
  post: ArticleCardData
}) {
  return (
    <Link
      href={`/${gameSlug}/blogs/${post.slug}`}
      className="group flex w-[268px] shrink-0 flex-col border border-[#1E2723] bg-[#121613] transition-colors hover:border-[#2F4237] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8FBF9C] sm:w-[320px]"
    >
      {/* ── Cover — 16:9 keeps the card compact ── */}
      <div className="relative aspect-video w-full overflow-hidden bg-[#0E1A11]">
        {post.cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote cover art
          <img
            src={post.cover}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          // No cover yet — a tinted hatch reads as deliberate where an empty
          // box reads as broken. Most posts will lack art for a while.
          <span
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                'repeating-linear-gradient(135deg, #0E1A11 0 10px, #0B1310 10px 20px)',
            }}
          />
        )}
        {/* Left scrim — lighter now that no display type sits on the art, so
            the photo reads more clearly while the eyebrow stays legible. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(103deg, rgba(4,18,12,.72) 0%, rgba(4,18,12,.34) 42%, rgba(4,18,12,.12) 78%, rgba(4,18,12,0) 100%)',
          }}
        />
        {/* Bottom fade — end stop matches the card bg, so no hard line.
            Scaled to the shorter 16:9 cover. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[72px]"
          style={{
            background:
              'linear-gradient(180deg, rgba(18,22,19,0) 0%, rgba(18,22,19,.55) 52%, rgba(18,22,19,.9) 80%, #121613 100%)',
          }}
        />
        {/* Detailing — slash strokes + dot grid, repositioned for 16:9. */}
        <span aria-hidden className="pointer-events-none absolute right-[62px] top-[14px] h-[44px] w-[2px] rotate-[32deg] bg-[#8FBF9C]/60" />
        <span aria-hidden className="pointer-events-none absolute right-[78px] top-[30px] h-[28px] w-[2px] rotate-[32deg] bg-white/25" />
        <span aria-hidden className="pointer-events-none absolute right-[94px] top-[46px] h-[16px] w-[2px] rotate-[32deg] bg-white/15" />
        <span
          aria-hidden
          className="pointer-events-none absolute right-[16px] top-[16px] h-[40px] w-[52px]"
          style={{
            background:
              'radial-gradient(rgba(255,255,255,.28) 1.6px, transparent 1.6px)',
            backgroundSize: '12px 12px',
          }}
        />
        {/* Category eyebrow only — the headline lives in the body, so putting
            it here too duplicated it and forced an ugly truncation. */}
        <span className="absolute left-[18px] top-[16px] flex items-center gap-2">
          <span aria-hidden className="h-[3px] w-5 bg-[#8FBF9C]" />
          <span className="font-mono text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#8FBF9C] [text-shadow:0_2px_10px_rgba(0,0,0,.8)]">
            {post.category}
          </span>
        </span>
      </div>

      {/* ── Body — headline, then a single meta row. ── */}
      <div className="flex flex-col gap-2.5 px-[18px] pb-[18px] pt-1">
        <span className="line-clamp-2 text-pretty text-[17px] font-extrabold leading-[1.15] tracking-[-0.02em] text-white sm:text-[18px]">
          {post.title}
        </span>
        <span aria-hidden className="h-px bg-[#1E2723]" />
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-bold text-[#CFD8D1]">
              {post.date}
            </span>
            <span aria-hidden className="h-1 w-1 bg-[#8FBF9C]" />
            <span className="flex items-center gap-1 font-mono text-[11px] font-bold text-[#CFD8D1]">
              <AccessTimeIcon sx={{ fontSize: 13 }} className="text-[#8FBF9C]" />
              {post.readMinutes} min
            </span>
          </span>
          <span className="flex items-center gap-1 font-mono text-[11px] font-extrabold tracking-[0.04em] text-[#8FBF9C]">
            READ
            <ArrowForwardIcon
              sx={{ fontSize: 15 }}
              className="transition-transform duration-200 group-hover:translate-x-1"
            />
          </span>
        </div>
      </div>
    </Link>
  )
}
