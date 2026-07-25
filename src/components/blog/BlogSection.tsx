'use client'

/**
 * V43 — Blog rail (Flock-Ramp "Our latest posts" band), shared across
 * marketplace surfaces. Posts come from the file-based blog module with
 * game-tagged posts surfaced first, so each game's pages show their
 * most relevant guides. Hidden automatically when there are no posts.
 */

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getPostsForGame } from '@/lib/blog/posts'
import { BlogCard } from '@/components/blog/BlogCard'
import { MobileSlider } from '@/components/ui/mobile-slider'
import { SectionHeading } from '@/components/marketplace/SectionHeading'

export function BlogSection({
  gameSlug,
  gameName,
}: {
  gameSlug: string
  gameName: string
}) {
  const posts = getPostsForGame(gameSlug, 4)
  if (posts.length === 0) return null

  return (
    // min-w-0: if an ancestor is ever a grid/flex track, stops the slider's
    // full row width leaking out and stretching the page (see V53 notes).
    <section className="mt-16 min-w-0 sm:mt-24">
      <SectionHeading
        kicker="Blog"
        title="Guides From The"
        accent="Pros"
        sub={`Trading guides, safety tips, and ${gameName} know-how from the team.`}
      />

      <div className="mt-6 flex justify-center">
        <Button
          asChild
          className="h-11 gap-2 whitespace-nowrap rounded-lg bg-lime px-6 text-[14px] font-bold text-text-inverse hover:bg-lime-hover"
        >
          <Link href="/blog">
            More Blogs
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      {/* V53 — Mobile swipes instead of stacking 4 full-width cards into a very
          tall column. Breakpoint must be `md` to match MobileSlider's
          activation: a `sm:` switch here would put embla and display:grid on
          the same element between 640–767px. */}
      <MobileSlider className="mt-10" itemCount={posts.length}>
        <div className="flex gap-x-4 md:grid md:grid-cols-2 md:gap-6 lg:hidden">
          {posts.map((p, i) => (
            // Fixed width, never a % basis (see the bundle slides): 280px
            // shows one card plus a clear peek of the next on a phone.
            <div key={p.slug} className="w-[280px] shrink-0 md:w-auto">
              <BlogCard post={p} index={i} />
            </div>
          ))}
        </div>
      </MobileSlider>

      {/* Desktop (lg+) — editorial split: the newest post runs wide with its
          cover beside the copy, the rest stack alongside it. Four equal columns
          gave every post the same weight and read like a grid of thumbnails.
          Rendered as its own tree (hidden below lg) because the featured card's
          shape differs too much to reach with utilities alone; the slider tree
          above is hidden at lg in turn, so only one is ever visible. */}
      {(() => {
        const [lead, ...rest] = posts
        return (
          // items-start, NOT the default stretch: stretch made the featured
          // card grow to the full height of the side column (1275px in
          // testing). Each column now sizes to its own content.
          <div className="mt-10 hidden gap-6 lg:grid lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:items-start">
            <BlogCard post={lead} index={0} variant="featured" />
            <div className="flex flex-col gap-3">
              {rest.map((p, i) => (
                <BlogCard key={p.slug} post={p} index={i + 1} variant="compact" />
              ))}
            </div>
          </div>
        )
      })()}
    </section>
  )
}
