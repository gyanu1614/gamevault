/**
 * V53 — Blog card, rebuilt.
 *
 * The old card was a bare cover + author row + title floating on the page
 * background: no frame, no excerpt, no date, and an uneven bottom edge that
 * left a block of dead space under short titles. It also ignored two fields
 * the posts already carry (`excerpt`, `publishedAt`).
 *
 * Now a framed glass card in the same language as the bundle/option tiles
 * (rectangular soft corners, hairline border, translucent fill, hover lift),
 * with a fixed 16/9 cover, the read time as an overlaid chip instead of its own
 * row, and a hairline footer. `h-full` + flex-column makes every card in a grid
 * end on the same line regardless of title length.
 *
 * `featured` renders the wide editorial variant: cover on the left, copy on the
 * right at desktop, for the lead post in a featured + 3-stacked layout.
 *
 * All sizing uses the semantic type tokens (`body-lg`/`body-sm`/`caption`/
 * `label`) rather than arbitrary px — see the type-scale convention.
 */

import Link from 'next/link'
import { ArrowUpRight, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BlogPost } from '@/lib/blog/posts'

/** Deterministic gradient tile for posts without cover art. */
const FALLBACK_GRADIENTS = [
  'bg-[radial-gradient(120%_120%_at_20%_15%,#2b2450_0%,#151322_55%,#0f0e18_100%)]',
  'bg-[radial-gradient(120%_120%_at_80%_20%,#233a1a_0%,#141a10_55%,#0e120b_100%)]',
  'bg-[radial-gradient(120%_120%_at_50%_85%,#3a2b18_0%,#1c1712_55%,#120f0c_100%)]',
]

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export type BlogCardVariant =
  /** Cover on top, title + excerpt + footer. Grid/slider default. */
  | 'default'
  /** Wide lead card: cover beside the copy at md+. */
  | 'featured'
  /** Thumbnail + title only — for the list beside a featured card. Keeps the
   *  side column short; three `default` cards stack ~1240px tall and stretch
   *  the featured card to match. */
  | 'compact'

export function BlogCard({
  post,
  index = 0,
  variant = 'default',
}: {
  post: BlogPost
  index?: number
  variant?: BlogCardVariant
}) {
  const date = formatDate(post.publishedAt)
  const featured = variant === 'featured'

  if (variant === 'compact') {
    return (
      <Link
        href={`/blog/${post.slug}`}
        className="group flex min-w-0 items-center gap-3 overflow-hidden rounded-lg border border-border-default bg-[rgba(20,20,27,0.56)] p-2.5 backdrop-blur-md transition-all duration-200 hover:border-border-strong hover:bg-[rgba(26,26,35,0.70)]"
      >
        <div
          className={cn(
            'relative h-[68px] w-[104px] shrink-0 overflow-hidden rounded-md',
            !post.cover && FALLBACK_GRADIENTS[index % FALLBACK_GRADIENTS.length],
          )}
        >
          {post.cover && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={post.cover}
              alt=""
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
            />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="line-clamp-2 text-body-sm font-bold leading-snug text-text-primary transition-colors group-hover:text-lime-text">
            {post.title}
          </h3>
          <span className="flex items-center gap-1.5 text-label text-text-tertiary">
            <Clock className="h-3 w-3 shrink-0" />
            <span className="tabular-nums">{post.readMinutes} min</span>
            {date && <span className="truncate">· {date}</span>}
          </span>
        </div>
        <ArrowUpRight className="h-4 w-4 shrink-0 text-text-tertiary transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-lime-text" />
      </Link>
    )
  }

  return (
    <Link
      href={`/blog/${post.slug}`}
      className={cn(
        'group flex h-full min-w-0 overflow-hidden rounded-lg border border-border-default bg-[rgba(20,20,27,0.56)] backdrop-blur-md transition-all duration-200',
        'hover:-translate-y-0.5 hover:border-border-strong hover:bg-[rgba(26,26,35,0.70)] hover:shadow-[0_12px_28px_-14px_rgba(0,0,0,0.65)]',
        featured ? 'flex-col md:flex-row' : 'flex-col',
      )}
    >
      {/* Cover */}
      <div
        className={cn(
          'relative shrink-0 overflow-hidden',
          !post.cover && FALLBACK_GRADIENTS[index % FALLBACK_GRADIENTS.length],
          featured ? 'aspect-[16/9] w-full md:aspect-auto md:w-1/2' : 'aspect-[16/9] w-full',
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
            className="absolute bottom-3 left-3 text-label-sm uppercase text-white/25"
          >
            DropMarket
          </span>
        )}

        {/* Scrim so the read-time chip stays legible on bright art. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-[linear-gradient(to_top,rgba(0,0,0,0.55),transparent)]"
        />

        {/* Read time — overlaid, so it doesn't cost the card a whole meta row. */}
        <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-[6px] bg-black/55 px-1.5 py-1 text-label text-white/90 backdrop-blur-sm">
          <Clock className="h-3 w-3 shrink-0" />
          <span className="tabular-nums">{post.readMinutes} min</span>
        </span>
      </div>

      {/* Copy — flex-1 so the footer pins to the bottom on every card. */}
      <div className={cn('flex min-w-0 flex-1 flex-col p-4', featured && 'md:p-5')}>
        <h3
          className={cn(
            'line-clamp-2 font-bold leading-snug text-text-primary transition-colors group-hover:text-lime-text',
            featured ? 'text-body-lg md:text-subheading' : 'text-body',
          )}
        >
          {post.title}
        </h3>

        {post.excerpt && (
          <p
            className={cn(
              'mt-2 text-body-sm leading-relaxed text-text-secondary',
              featured ? 'line-clamp-3' : 'line-clamp-2',
            )}
          >
            {post.excerpt}
          </p>
        )}

        {/* Footer pinned to the card bottom by mt-auto. */}
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-border-subtle pt-3 text-caption text-text-tertiary">
          <span className="truncate">{date || post.author}</span>
          <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-text-secondary transition-colors group-hover:text-lime-text">
            Read
            <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </span>
        </div>
      </div>
    </Link>
  )
}
