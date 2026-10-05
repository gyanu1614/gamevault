/**
 * "All <game> guides" — a clean, uniform card GRID (newest first). Replaced the
 * Embla carousel whose variable-height / fixed-width cards read as glitchy: now
 * every card is the same fixed-ratio tile in a responsive grid, so nothing jumps.
 */

import Link from '@/components/navigation/AppLink'
import { ArrowRightIcon } from '@phosphor-icons/react/dist/ssr/ArrowRight'
import { ClockIcon } from '@phosphor-icons/react/dist/ssr/Clock'
import { VALUE_SURFACE_LINK } from '@/components/values/styles'

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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <GuideCard key={post.slug} gameSlug={gameSlug} post={post} />
        ))}
      </div>
    </section>
  )
}

/* ─── 4A blog post card ──────────────────────────────────────────────────── */

/**
 * Uniform blog card — fills its grid cell, same structure every time so a grid
 * of them never jumps: fixed 16:9 cover, category eyebrow, 2-line-clamped title,
 * 2-line excerpt, and a meta footer pinned to the bottom (mt-auto).
 * Exported so the admin editor preview stays pixel-identical.
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
      href={`/${gameSlug}/blog/${post.slug}`}
      className={`group flex h-full flex-col overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${VALUE_SURFACE_LINK}`}
    >
      {/* Cover — fixed 16:9 so every card is the same height. */}
      <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden">
        {post.cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote cover art
          <img
            src={post.cover}
            alt=""
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
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 text-balance text-[17px] font-semibold leading-[1.25] tracking-[-0.02em] text-text-primary sm:text-[18px]">
          {post.title}
        </h3>
        {post.excerpt && (
          <p className="line-clamp-2 text-[13px] leading-[1.5] text-text-secondary">{post.excerpt}</p>
        )}
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
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
