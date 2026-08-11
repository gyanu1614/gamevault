/**
 * "All <game> guides" — a clean, uniform card GRID (newest first). Replaced the
 * Embla carousel whose variable-height / fixed-width cards read as glitchy: now
 * every card is the same fixed-ratio tile in a responsive grid, so nothing jumps.
 */

import Link from 'next/link'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
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
  if (posts.length === 0) return null

  return (
    <section className="pt-12 sm:pt-16">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[20px] font-semibold tracking-tight text-[#F1F3F1] sm:text-[24px]">
          All {gameName} guides
        </h2>
        <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-[#5E685E]">
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
      className="group flex h-full flex-col overflow-hidden border border-[#1E2723] bg-[#121613] transition-colors duration-200 hover:border-[#33453A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8FBF9C]"
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
          <span
            aria-hidden
            className="absolute inset-0"
            style={{ background: 'repeating-linear-gradient(135deg, #0E1A11 0 10px, #0B1310 10px 20px)' }}
          />
        )}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2"
          style={{ background: 'linear-gradient(180deg, rgba(18,22,19,0) 0%, rgba(18,22,19,.55) 100%)' }}
        />
        <span className="absolute left-3.5 top-3 border border-white/10 bg-black/40 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#A7D8B6] backdrop-blur-sm">
          {post.category}
        </span>
      </div>

      {/* Body — grows to fill; meta pinned to the bottom so all cards align. */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 text-balance text-[17px] font-bold leading-[1.25] tracking-[-0.02em] text-[#F2F6F0] transition-colors group-hover:text-white sm:text-[18px]">
          {post.title}
        </h3>
        {post.excerpt && (
          <p className="line-clamp-2 text-[13px] leading-[1.5] text-[#9BA8A0]">{post.excerpt}</p>
        )}
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <span className="flex items-center gap-2 text-[11.5px] font-medium text-[#98A69C]">
            <span>{post.date}</span>
            <span aria-hidden className="h-1 w-1 rounded-full bg-[#4A574F]" />
            <span className="flex items-center gap-1">
              <AccessTimeIcon sx={{ fontSize: 13 }} className="text-[#6E7C73]" />
              {post.readMinutes} min
            </span>
          </span>
          <span className="flex items-center gap-1 text-[12px] font-bold text-[#8FBF9C] transition-colors group-hover:text-[#B6E3C4]">
            Read
            <ArrowForwardIcon sx={{ fontSize: 15 }} className="transition-transform duration-200 group-hover:translate-x-1" />
          </span>
        </div>
      </div>
    </Link>
  )
}
