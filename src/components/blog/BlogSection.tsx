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
    <section className="mt-16 sm:mt-24">
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

      <div className="mt-10 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
        {posts.map((p, i) => (
          <BlogCard key={p.slug} post={p} index={i} />
        ))}
      </div>
    </section>
  )
}
