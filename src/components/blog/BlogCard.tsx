/**
 * V42 — Blog card (Flock-Ramp style): big rounded cover, author + read
 * time row, bold title. Whole card links to the article. Used by the
 * listing detail page's blog rail and the /blog index.
 */

import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { BlogPost } from '@/lib/blog/posts'

/** Deterministic gradient tile for posts without cover art. */
const FALLBACK_GRADIENTS = [
  'bg-[radial-gradient(120%_120%_at_20%_15%,#2b2450_0%,#151322_55%,#0f0e18_100%)]',
  'bg-[radial-gradient(120%_120%_at_80%_20%,#233a1a_0%,#141a10_55%,#0e120b_100%)]',
  'bg-[radial-gradient(120%_120%_at_50%_85%,#3a2b18_0%,#1c1712_55%,#120f0c_100%)]',
]

export function BlogCard({ post, index = 0 }: { post: BlogPost; index?: number }) {
  return (
    <Link href={`/blog/${post.slug}`} className="group block min-w-0">
      {/* Cover */}
      <div
        className={cn(
          'relative aspect-[4/3] w-full overflow-hidden rounded-2xl ring-1 ring-border-subtle',
          !post.cover && FALLBACK_GRADIENTS[index % FALLBACK_GRADIENTS.length],
        )}
      >
        {post.cover ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={post.cover}
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <span
            aria-hidden
            className="absolute bottom-4 left-4 text-[13px] font-bold uppercase tracking-[0.2em] text-white/25"
          >
            DropMarket
          </span>
        )}
      </div>

      {/* Meta row */}
      <div className="mt-4 flex items-center justify-between gap-3 text-[13.5px] text-text-tertiary">
        <span className="truncate">{post.author}</span>
        <span className="shrink-0 tabular-nums">{post.readMinutes} min read</span>
      </div>

      {/* Title */}
      <h3 className="mt-2 text-[18px] font-bold leading-snug text-text-primary transition-colors group-hover:text-lime-text sm:text-[19px]">
        {post.title}
      </h3>
    </Link>
  )
}
