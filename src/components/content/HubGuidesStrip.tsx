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
 * Each card is the values-hub clickable surface (VALUE_SURFACE_LINK: 8px,
 * card gradient, no outline) with the post's cover image as a DARKENED
 * background (a near-black scrim over it) so the cards look rich while the text
 * stays legible. Posts with no cover fall back to the plain card gradient.
 */

import Link from '@/components/navigation/AppLink'
import { getPostsTaggedForGame } from '@/lib/blog/db'
import { VALUE_LABEL, VALUE_SURFACE_LINK } from '@/components/values/styles'

const POST_TYPE_LABEL: Record<string, string> = {
  value: 'Value List',
  seller: 'Seller Guide',
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
      <h2 className="mb-4 text-[22px] font-bold tracking-tight text-text-primary">
        {heading}
      </h2>
      <div className="grid gap-4 sm:grid-cols-3">
        {posts.map((p) => (
          <Link
            key={p.slug}
            href={`/${gameSlug}/blog/${p.slug}`}
            className={`group relative flex min-h-[180px] flex-col justify-end overflow-hidden p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${VALUE_SURFACE_LINK}`}
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
                  className="absolute inset-0 h-full w-full object-cover opacity-40 transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                />
                {/* Near-black gradient — heavier at the bottom where the text
                    sits, so the copy always reads regardless of the image. */}
                <span
                  aria-hidden
                  className="absolute inset-0"
                  style={{
                    background:
                      'linear-gradient(180deg, rgba(22,23,27,0.55) 0%, rgba(22,23,27,0.80) 55%, rgba(22,23,27,0.94) 100%)',
                  }}
                />
              </>
            )}

            {/* Content — above the image + scrim. Eyebrow + title only; the
                excerpt was a smaller, mismatched face that cluttered the card. */}
            <div className="relative z-10 flex flex-col gap-2.5">
              <span className={VALUE_LABEL}>
                {POST_TYPE_LABEL[p.postType] ?? 'Guide'}
              </span>
              <span className="text-[15px] font-semibold leading-snug text-text-primary">
                {p.title}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
