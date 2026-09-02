/**
 * HubGuidesStrip — a compact "guides for this game" strip for the MONEY pages
 * (values, calculator). Its whole job is the internal-link mesh: the value list
 * and the calculator are the site's highest-authority, highest-intent pages, and
 * before this they passed ZERO equity into blog content. Dropping 3 tagged
 * guides here flows that authority into articles and cuts blog crawl depth to a
 * single hop from the crawler's favourite pages.
 *
 * Server component. It self-HIDES when the game has no tagged posts, so a game
 * whose content library is still empty renders nothing (no dead section). The
 * anchor is the post TITLE (keyword-rich, unique per card) — never "read more".
 *
 * Each card uses the post's cover image as a DARKENED background (a forest-dark
 * gradient scrim over it) so the cards look rich while the text stays legible.
 * Posts with no cover fall back to a flat near-black card.
 */

import Link from 'next/link'
import { getPostsTaggedForGame } from '@/lib/blog/db'

const POST_TYPE_LABEL: Record<string, string> = {
  value: 'Value list',
  seller: 'Seller guide',
  guide: 'Guide',
}

export async function HubGuidesStrip({
  gameSlug,
  heading,
  className = '',
}: {
  gameSlug: string
  /** Section heading — keyword-forward, e.g. "Guides for pricing & trading {game}". */
  heading: string
  className?: string
}) {
  const posts = await getPostsTaggedForGame(gameSlug, 3)
  // Self-hide: no content to link → render nothing (no empty section).
  if (posts.length === 0) return null

  return (
    <section className={`mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 ${className}`}>
      <h2 className="mb-4 text-[22px] font-bold tracking-tight text-[#F2F6F0]">
        {heading}
      </h2>
      <div className="grid gap-4 sm:grid-cols-3">
        {posts.map((p) => (
          <Link
            key={p.slug}
            href={`/${gameSlug}/blog/${p.slug}`}
            className="group relative flex min-h-[180px] flex-col justify-end overflow-hidden rounded-lg border border-[#1E2723] bg-[#0B0F0C] p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#2F6B46]"
          >
            {/* Cover image background + dark scrim (only when a cover exists).
                Plain <img> to match how the article page renders covers and to
                avoid next/image remote-host config for arbitrary cover URLs. */}
            {p.cover && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.cover}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover opacity-40 transition-transform duration-500 group-hover:scale-105"
                />
                {/* Forest-dark gradient — heavier at the bottom where the text
                    sits, so the copy always reads regardless of the image. */}
                <span
                  aria-hidden
                  className="absolute inset-0"
                  style={{
                    background:
                      'linear-gradient(180deg, rgba(11,15,12,0.55) 0%, rgba(11,15,12,0.80) 55%, rgba(11,15,12,0.94) 100%)',
                  }}
                />
              </>
            )}

            {/* Content — above the image + scrim. */}
            <div className="relative z-10 flex flex-col gap-2.5">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8FBF9C]">
                {POST_TYPE_LABEL[p.postType] ?? 'Guide'}
              </span>
              <span className="text-[15px] font-semibold leading-snug text-[#F1F5EF]">
                {p.title}
              </span>
              {p.excerpt && (
                <span className="line-clamp-2 text-[13px] leading-relaxed text-[#C2CBC2]">
                  {p.excerpt}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
