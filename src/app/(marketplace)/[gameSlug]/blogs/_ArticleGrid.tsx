/**
 * "All <game> guides" — the article grid below the featured guide.
 *
 * Hairline-grid layout from the content design (cells share 1px gutters that
 * read as rules), painted in the Values forest palette. On mobile the grid
 * becomes a horizontal snap-scroll rail so the section doesn't stack into a
 * long column — matching the design's mobile treatment.
 */

import Link from 'next/link'

export interface ArticleCardData {
  slug: string
  title: string
  excerpt: string
  category: string
  date: string
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
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-[20px] font-semibold tracking-tight text-[#F1F3F1] sm:text-[24px]">
          All {gameName} guides
        </h2>
        <span className="font-mono text-[11px] text-[#5E685E] sm:hidden">
          SWIPE →
        </span>
        <span className="hidden font-mono text-[11px] text-[#5E685E] sm:inline">
          {posts.length} {posts.length === 1 ? 'GUIDE' : 'GUIDES'}
        </span>
      </div>

      {/* Mobile: horizontal rail. Desktop: hairline grid. */}
      <div
        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-px sm:overflow-visible sm:border sm:border-[#1A211A] sm:bg-[#1A211A] sm:px-0 sm:pb-0 lg:grid-cols-4 [&::-webkit-scrollbar]:hidden"
      >
        {posts.map((post) => (
          <Link
            key={post.slug}
            href={`/${gameSlug}/blogs/${post.slug}`}
            className="group flex min-w-[262px] shrink-0 snap-start flex-col border border-[#1A211A] bg-[#0B0F0C] p-5 transition-colors hover:bg-[#101710] sm:min-w-0 sm:border-0"
          >
            <div className="mb-4 flex items-center justify-between gap-2.5">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[#4FB477]">
                {post.category}
              </span>
              <span className="font-mono text-[10px] text-[#5E685E]">
                {post.date}
              </span>
            </div>
            <h3 className="mb-3 text-[17px] font-semibold leading-snug tracking-tight text-[#F1F3F1] sm:text-[18px]">
              {post.title}
            </h3>
            <p className="mb-5 line-clamp-3 text-[13.5px] leading-relaxed text-[#98A398] sm:text-sm">
              {post.excerpt}
            </p>
            <div className="mt-auto flex items-center justify-between border-t border-[#1A211A] pt-4">
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#5E685E]">
                Read guide
              </span>
              <span className="font-mono text-[11px] font-semibold text-[#4FB477] transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
