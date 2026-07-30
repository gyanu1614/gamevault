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
      className="group flex w-[300px] shrink-0 flex-col border border-[#1E2723] bg-[#121613] transition-colors hover:border-[#2F4237] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8FBF9C] sm:w-[400px]"
    >
      {/* ── Cover — photo with display type over it ── */}
      <div className="relative aspect-[440/262] w-full overflow-hidden bg-[#0E1A11]">
        {post.cover && (
          // eslint-disable-next-line @next/next/no-img-element -- remote cover art
          <img
            src={post.cover}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        {/* Side scrim — keeps display type legible on any art. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(103deg, rgba(4,18,12,.93) 0%, rgba(4,18,12,.78) 40%, rgba(4,18,12,.36) 74%, rgba(4,18,12,.14) 100%)',
          }}
        />
        {/* Bottom fade — end stop matches the card bg, so no hard line. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[130px]"
          style={{
            background:
              'linear-gradient(180deg, rgba(18,22,19,0) 0%, rgba(18,22,19,.5) 48%, rgba(18,22,19,.88) 78%, #121613 100%)',
          }}
        />
        {/* Right edge fade. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-10"
          style={{
            background:
              'linear-gradient(270deg, rgba(18,22,19,.85) 0%, rgba(18,22,19,0) 100%)',
          }}
        />
        {/* Detailing — slash strokes + dot grid on the cover's right. */}
        <span aria-hidden className="pointer-events-none absolute right-[88px] top-[34px] h-[66px] w-[2px] rotate-[32deg] bg-[#8FBF9C]/60" />
        <span aria-hidden className="pointer-events-none absolute right-[110px] top-[58px] h-[42px] w-[2px] rotate-[32deg] bg-white/25" />
        <span aria-hidden className="pointer-events-none absolute right-[130px] top-[82px] h-[24px] w-[2px] rotate-[32deg] bg-white/15" />
        <span
          aria-hidden
          className="pointer-events-none absolute right-[22px] top-[104px] h-[56px] w-[72px]"
          style={{
            background:
              'radial-gradient(rgba(255,255,255,.3) 1.7px, transparent 1.7px)',
            backgroundSize: '13px 13px',
          }}
        />
        {/* Cover text block — display type kept out of the fade band. */}
        <span className="absolute inset-y-0 left-0 flex flex-col justify-center gap-2.5 px-[26px] pb-[74px]">
          <span className="flex items-center gap-2">
            <span aria-hidden className="h-[3px] w-5 bg-[#8FBF9C]" />
            <span className="font-mono text-[11px] font-extrabold uppercase tracking-[0.24em] text-[#8FBF9C]">
              {post.category}
            </span>
          </span>
          <span className="line-clamp-2 max-w-[85%] text-[26px] font-black uppercase leading-[1.02] tracking-[0.005em] text-white [text-shadow:0_3px_18px_rgba(0,0,0,.7)] sm:text-[32px]">
            {post.title}
          </span>
        </span>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-col gap-3.5 px-[26px] pb-[26px] pt-1">
        <div className="flex items-center gap-2.5">
          <span className="bg-[#8FBF9C] px-[9px] py-[5px] font-mono text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#08110B]">
            {post.category}
          </span>
        </div>
        <span className="line-clamp-2 text-pretty text-[20px] font-extrabold leading-[1.1] tracking-[-0.02em] text-white sm:text-[22px]">
          {post.title}
        </span>
        <span aria-hidden className="mt-1 h-px bg-[#1E2723]" />
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-3">
            <span className="font-mono text-[12px] font-bold text-[#CFD8D1]">
              {post.date}
            </span>
            <span aria-hidden className="h-1 w-1 bg-[#8FBF9C]" />
            <span className="flex items-center gap-1.5 font-mono text-[12px] font-bold text-[#CFD8D1]">
              <AccessTimeIcon sx={{ fontSize: 15 }} className="text-[#8FBF9C]" />
              {post.readMinutes} min read
            </span>
          </span>
          <span className="flex items-center gap-1 font-mono text-[12px] font-extrabold tracking-[0.04em] text-[#8FBF9C]">
            READ
            <ArrowForwardIcon
              sx={{ fontSize: 17 }}
              className="transition-transform duration-200 group-hover:translate-x-1"
            />
          </span>
        </div>
      </div>
    </Link>
  )
}
