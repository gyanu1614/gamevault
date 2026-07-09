/**
 * V42 — Blog index: every post from the file-based blog module, newest
 * first, in the same card grid as the listing-page rail.
 */

import type { Metadata } from 'next'
import { getAllPosts } from '@/lib/blog/posts'
import { BlogCard } from '@/components/blog/BlogCard'

export const metadata: Metadata = {
  title: 'Blog — Trading Guides & Safety Tips',
  description:
    'Trading guides, item value breakdowns, and marketplace safety tips from the DropMarket team.',
}

export default function BlogIndexPage() {
  const posts = getAllPosts()
  return (
    <main className="min-h-screen pb-24">
      <div className="mx-auto w-full max-w-7xl px-4 pt-12 sm:px-6 sm:pt-16 lg:px-8">
        <div className="text-center">
          <div className="text-[15px] font-bold uppercase tracking-[0.18em] text-lime-text sm:text-[20px]">
            — Blog —
          </div>
          <h1 className="mt-0.5 text-[30px] font-extrabold leading-[1.05] tracking-tight text-text-primary sm:text-[40px]">
            Guides From The <span className="text-lime-text">Vault</span>
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-[15px] text-text-tertiary sm:text-[16.5px]">
            Trading guides, safety tips, and marketplace know-how from the team.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((p, i) => (
            <BlogCard key={p.slug} post={p} index={i} />
          ))}
        </div>
      </div>
    </main>
  )
}
