/**
 * "All <game> guides" (newest first), uniform cards so nothing jumps:
 *  - phones: a swipeable row (CSS scroll-snap, no carousel library — the old
 *    Embla one read as glitchy), one card with the next one peeking;
 *  - sm+: a grid, 3 then 4 across — short cards: cover, title, meta (owner,
 *    2026-10-14: the summary made every card too long).
 */

import Link from '@/components/navigation/AppLink'
import { ArrowRightIcon } from '@phosphor-icons/react/dist/ssr/ArrowRight'
import { ClockIcon } from '@phosphor-icons/react/dist/ssr/Clock'
import { VALUE_SURFACE_LINK } from '@/components/values/styles'

export interface ArticleCardData {
  slug: string
  /** The post's canonical address (postHref). */
  href: string
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
  if (posts.length === 0) return null

  return (
    <section className="pt-12 sm:pt-16">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-subheading text-text-primary sm:text-heading">
          All {gameName} Guides
        </h2>
        <span className="text-[12px] font-medium tabular-nums text-text-tertiary">
          {posts.length} {posts.length === 1 ? 'guide' : 'guides'}
        </span>
      </div>

      <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto overscroll-x-contain px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4 [&::-webkit-scrollbar]:hidden">
        {posts.map((post) => (
          <div key={post.slug} className="w-[78%] max-w-[320px] shrink-0 snap-start sm:w-auto sm:max-w-none">
            <GuideCard gameSlug={gameSlug} post={post} />
          </div>
        ))}
      </div>
    </section>
  )
}

/* ─── 4A blog post card ──────────────────────────────────────────────────── */

/**
 * Uniform blog card — fills its cell, same structure every time so a row of
 * them never jumps: fixed 16:9 cover, category eyebrow, 2-line-clamped title
 * (no summary: it made the cards too long), and a meta footer pinned to the
 * bottom (mt-auto). Exported so the admin editor preview stays pixel-identical.
 */
export function GuideCard({
  gameSlug,
  post,
}: {
  gameSlug: string
  post: ArticleCardData
}) {
  return (
    <Link
      href={post.href}
      className={`group flex h-full flex-col overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${VALUE_SURFACE_LINK}`}
    >
      {/* Cover — fixed 16:9 so every card is the same height. */}
      <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden">
        {post.cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote cover art
          <img
            src={post.cover}
            alt={post.title}
            aria-hidden
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <span aria-hidden className="absolute inset-0 bg-white/[0.04]" />
        )}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2"
          style={{ background: 'linear-gradient(180deg, rgba(33,34,40,0) 0%, rgba(33,34,40,.55) 100%)' }}
        />
        <span className="absolute left-3.5 top-3 rounded bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-text-primary backdrop-blur-sm">
          {post.category}
        </span>
      </div>

      {/* Body — grows to fill; meta pinned to the bottom so all cards align. */}
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <h3 className="line-clamp-2 text-balance text-[15.5px] font-semibold leading-[1.3] tracking-[-0.01em] text-text-primary">
          {post.title}
        </h3>
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <span className="flex items-center gap-2 text-[11.5px] font-medium text-text-tertiary">
            <span>{post.date}</span>
            <span aria-hidden className="h-1 w-1 rounded-full bg-white/20" />
            <span className="flex items-center gap-1">
              <ClockIcon size={13} weight="bold" aria-hidden />
              {post.readMinutes} min
            </span>
          </span>
          <span className="flex items-center gap-1 text-[12px] font-semibold text-text-secondary transition-colors group-hover:text-text-primary">
            Read
            <ArrowRightIcon size={14} weight="bold" aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" />
          </span>
        </div>
      </div>
    </Link>
  )
}
