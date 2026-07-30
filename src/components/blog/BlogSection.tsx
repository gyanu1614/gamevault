'use client'

/**
 * V54 — Blog rail (shared "guides" band across marketplace surfaces). Now
 * presentational: it receives already-fetched posts (from the DB via a server
 * page) + their resolved hrefs, so it works from any client or server tree
 * without a data dependency. Hidden automatically when there are no posts.
 *
 * Each post carries its true href (nested /[game]/blogs/[slug] when it has a
 * game, else /blog/[slug]) so the rail never links through a 301 redirect.
 */

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { BlogPost } from '@/lib/blog/posts'
import { BlogCard } from '@/components/blog/BlogCard'
import { MobileSlider } from '@/components/ui/mobile-slider'
import { SectionHeading } from '@/components/marketplace/SectionHeading'

export type BlogRailPost = BlogPost & { href: string }

export function BlogSection({
  posts,
  gameName,
  /** Where "More Blogs" points — the game's nested blog index when available. */
  moreHref = '/blog',
}: {
  posts: BlogRailPost[]
  gameName: string
  moreHref?: string
}) {
  if (!posts || posts.length === 0) return null

  return (
    // min-w-0: if an ancestor is ever a grid/flex track, stops the slider's
    // full row width leaking out and stretching the page.
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
          <Link href={moreHref}>
            More Blogs
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      {/* Mobile: swipe instead of stacking 4 full-width cards. */}
      <MobileSlider className="mt-10" itemCount={posts.length}>
        <div className="flex gap-x-4 md:grid md:grid-cols-2 md:gap-6 lg:hidden">
          {posts.map((p, i) => (
            <div key={p.slug} className="w-[280px] shrink-0 md:w-auto">
              <BlogCard post={p} index={i} href={p.href} />
            </div>
          ))}
        </div>
      </MobileSlider>

      {/* Desktop (lg+): editorial split — newest wide, rest stacked. */}
      {(() => {
        const [lead, ...rest] = posts
        return (
          <div className="mt-10 hidden gap-6 lg:grid lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:items-start">
            <BlogCard post={lead} index={0} variant="featured" href={lead.href} />
            <div className="flex flex-col gap-3">
              {rest.map((p, i) => (
                <BlogCard
                  key={p.slug}
                  post={p}
                  index={i + 1}
                  variant="compact"
                  href={p.href}
                />
              ))}
            </div>
          </div>
        )
      })()}
    </section>
  )
}
