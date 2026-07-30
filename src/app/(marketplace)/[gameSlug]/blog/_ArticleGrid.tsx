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
      className="group relative flex w-[300px] shrink-0 flex-col border border-[#1E2723] bg-[#121613] transition-colors duration-200 hover:border-[#33453A] hover:bg-[#171D19] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8FBF9C] sm:w-[392px]"
    >
      {/* ── Interior accent, same recipe as the currency bundle tiles: a soft
          pool of accent light inside the card rather than a flat fill, brought
          up on hover. Ours is forest rather than lime.

          Both layers sit FIRST in the DOM and every sibling below is
          `relative`, so painting order alone keeps them behind the art and the
          type — no z-index, which is what let cards climb over the navbar the
          last time. ── */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-75 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            'radial-gradient(115% 85% at 6% 100%, rgba(79,180,119,0.15), rgba(79,180,119,0.045) 44%, rgba(18,22,19,0) 74%)',
        }}
      />
      {/* Spotlight pool under the cover — lifts the art off the body, the way
          the bundle tile's icon spotlight does. */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[48%] h-14 w-4/5 -translate-x-1/2 bg-[#4FB4771F] opacity-60 blur-2xl transition-opacity duration-300 group-hover:opacity-100"
      />
      {/* ── Cover — 2:1 rather than 16:9. The card got wider to fit more of the
          headline per line, and a 16:9 crop would have grown the height with it;
          the wider ratio keeps the card's height where it was. ── */}
      <div className="relative aspect-[2/1] w-full shrink-0 overflow-hidden bg-[#0E1A11]">
        {post.cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote cover art
          // Overscanned by 1px on every side: at fractional device-pixel
          // offsets an exactly-inset image can expose a hairline of raw art at
          // the overflow-hidden edge, which read as a red/green line flashing
          // under the cover on hover. No hover zoom — the highlight is the grey
          // lift on the card, nothing moves.
          <img
            src={post.cover}
            alt=""
            // max-w-none is required: the preflight `img { max-width: 100% }`
            // otherwise clamps the box back to the clip width, which left a
            // 1px gap on the right — an edge that can flash raw art.
            className="absolute -inset-px h-[calc(100%+2px)] w-[calc(100%+2px)] max-w-none object-cover"
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

      {/* ── Body — headline, then a single meta row. ──
          The headline is the one thing meant to catch the eye, so it gets the
          size and the near-white; the meta row was competing at #CFD8D1 bold
          and is now demoted to a quiet grey. Nothing here shouts except the
          title. */}
      <div className="relative flex flex-col gap-3 px-5 pb-5 pt-2">
        <span className="line-clamp-2 text-balance text-[19px] font-extrabold leading-[1.18] tracking-[-0.025em] text-[#F7FAF6] transition-colors duration-200 group-hover:text-white sm:text-[21px]">
          {post.title}
        </span>
        {/* Hairline fading to the right (bundle-tile detail), with a mint wipe
            on hover — the card's one piece of motion aimed at the type rather
            than the art. */}
        <span aria-hidden className="relative block h-px bg-[linear-gradient(90deg,#1E2723,rgba(30,39,35,0))]">
          <span className="absolute inset-y-0 left-0 w-full origin-left scale-x-0 bg-[linear-gradient(90deg,#8FBF9C,rgba(143,191,156,0))] transition-transform duration-500 ease-out group-hover:scale-x-100" />
        </span>
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-medium text-[#818E86]">
              {post.date}
            </span>
            <span aria-hidden className="h-1 w-1 bg-[#3C4A41]" />
            <span className="flex items-center gap-1 font-mono text-[11px] font-medium text-[#818E86]">
              <AccessTimeIcon sx={{ fontSize: 13 }} className="text-[#5D6B62]" />
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
