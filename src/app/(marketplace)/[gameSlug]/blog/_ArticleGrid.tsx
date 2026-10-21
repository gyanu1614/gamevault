/**
 * "All <game> guides" (newest first), uniform cards so nothing jumps:
 *  - phones: a swipeable row (CSS scroll-snap, no carousel library — the old
 *    Embla one read as glitchy), one card with the next one peeking;
 *  - sm+: a grid, 3 then 4 across — short cards: cover, title, meta (owner,
 *    2026-10-14: the summary made every card too long).
 */

import { GuideRow, type ArticleCardData } from '@/components/blog/GuideCard'

export type { ArticleCardData }

export function ArticleGrid({
  gameName,
  posts,
}: {
  gameName: string
  /** Kept for call-site compatibility; the cards carry their own links. */
  gameSlug?: string
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

      <GuideRow posts={posts} />
    </section>
  )
}
