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
      href={`/${gameSlug}/blog/${post.slug}`}
      // Original card size restored: fixed width, height driven by the 2:1
      // cover + body content — NOT a tall fixed height. The image still fills
      // the card because the body sits over the cover's faded lower area.
      className="group relative flex w-[300px] shrink-0 flex-col justify-end overflow-hidden border border-[#1E2723] bg-[#121613] transition-colors duration-200 hover:border-[#33453A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8FBF9C] sm:w-[392px]"
    >
      {/* ── Cover — 2:1, fills the card width. The body below overlaps its
          faded lower edge (negative margin) so the photo continues behind the
          title instead of ending at a hard panel line. ── */}
      <div className="relative aspect-[2/1] w-full shrink-0 overflow-hidden">
        {post.cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote cover art
          <img
            src={post.cover}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                'repeating-linear-gradient(135deg, #0E1A11 0 10px, #0B1310 10px 20px)',
            }}
          />
        )}
        {/* Bottom fade-to-card — the photo dissolves into the card colour, no
            hard seam. End stop equals the card bg (#121613). */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3"
          style={{
            background:
              'linear-gradient(180deg, rgba(18,22,19,0) 0%, rgba(18,22,19,.4) 45%, rgba(18,22,19,.82) 78%, #121613 100%)',
          }}
        />
        {/* Category eyebrow — top-left over the art. Figtree, no dash. */}
        <span className="absolute left-[18px] top-[16px] text-[12px] font-bold uppercase tracking-[0.08em] text-[#A7D8B6] [text-shadow:0_2px_10px_rgba(0,0,0,.85)]">
          {post.category}
        </span>
      </div>

      {/* ── Body — pulled up over the cover's faded tail. No divider rule. ── */}
      <div className="relative z-[1] -mt-8 flex flex-col gap-3 px-5 pb-5">
        <span className="line-clamp-2 text-balance text-[19px] font-extrabold leading-[1.18] tracking-[-0.025em] text-[#F7FAF6] transition-colors duration-200 group-hover:text-white sm:text-[21px]">
          {post.title}
        </span>
        <div className="flex items-center justify-between gap-2">
          {/* Meta in Figtree (our text font), not mono. */}
          <span className="flex items-center gap-2 text-[12px] font-medium text-[#98A69C]">
            <span>{post.date}</span>
            <span aria-hidden className="h-1 w-1 rounded-full bg-[#4A574F]" />
            <span className="flex items-center gap-1">
              <AccessTimeIcon sx={{ fontSize: 14 }} className="text-[#6E7C73]" />
              {post.readMinutes} min
            </span>
          </span>
          <span className="flex items-center gap-1 text-[12px] font-bold tracking-[0.02em] text-[#8FBF9C] transition-colors group-hover:text-[#B6E3C4]">
            Read
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
