/**
 * Featured Guide block — the "5B" design from the marketplace banner handoff.
 *
 * A wide clickable row: cover photo on the left dissolving horizontally into a
 * dark text panel on the right (no divider line — the gradient IS the seam).
 * Below ~lg it stacks: image becomes a 16:9 band fading down into the panel.
 *
 * Palette is mapped onto our forest tokens per the handoff's token contract:
 * block #0C0F0E, hairline #1E2723, accent #3FA35C (hover #4CBB6B), mint
 * #8FBF9C, on-green #08110B. Fade end stops MUST equal the block background.
 */

import Link from 'next/link'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'

const UPDATED = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

export function FeaturedGuide({
  href,
  category,
  readMinutes,
  title,
  excerpt,
  publishedAt,
  cover,
}: {
  href: string
  category: string
  readMinutes: number
  title: string
  excerpt: string
  publishedAt: string
  cover?: string | null
  /** Kept for call-site compatibility; unused in the 5B design. */
  initials?: string
}) {
  const updated = (() => {
    const d = new Date(publishedAt)
    return Number.isFinite(d.getTime()) ? UPDATED.format(d).toUpperCase() : null
  })()

  return (
    <section className="pt-12 sm:pt-16">
      <h2 className="mb-4 text-[20px] font-semibold tracking-tight text-[#F1F3F1] sm:text-[24px]">
        Featured guide
      </h2>

      <Link
        href={href}
        // No hover background here: the photo dissolve's end stops are pinned
        // to #0C0F0E, so shifting the block's bg would open a visible seam in
        // the gradient. Border + CTA carry the hover state instead.
        className="group relative block overflow-hidden border border-[#1E2723] bg-[#0C0F0E] transition-colors duration-200 hover:border-[#33453A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3FA35C] lg:h-[360px]"
      >
        {/* ── Image layer ── */}
        {/* Mobile: full-width 16:9 band. Desktop: absolute left half. */}
        <div className="relative aspect-video w-full overflow-hidden lg:absolute lg:inset-y-0 lg:left-0 lg:aspect-auto lg:h-full lg:w-[52%]">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote cover art
            <img
              src={cover}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full bg-[#0E1A11]" />
          )}
          {/* Horizontal fade into the panel (desktop) — starts melting the
              photo earlier so the dissolve reads clearly. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 hidden lg:block"
            style={{
              background:
                'linear-gradient(90deg, rgba(12,15,14,.55) 0%, rgba(12,15,14,.15) 34%, rgba(12,15,14,.45) 58%, rgba(12,15,14,.85) 78%, #0C0F0E 94%)',
            }}
          />
          {/* Vertical fade — subtle on desktop, the dissolve on mobile. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, rgba(12,15,14,.5) 0%, rgba(12,15,14,0) 30%, rgba(12,15,14,.55) 78%, #0C0F0E 100%)',
            }}
          />
          {/* Overlay label row */}
          <span className="pointer-events-none absolute left-[30px] top-[26px] flex items-center gap-3">
            <span className="bg-[#3FA35C] px-[11px] py-1.5 font-mono text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#08110B]">
              Featured
            </span>
            <span className="font-mono text-[12px] font-extrabold uppercase tracking-[0.2em] text-white [text-shadow:0_2px_10px_rgba(0,0,0,.8)]">
              Guide
            </span>
          </span>
        </div>

        {/* ── Interior accent — the currency bundle tiles' pool-of-light idea
            in forest, pooling behind the copy and CTA so the panel isn't a flat
            dark rectangle. Sits after the image layer and before the panel, so
            painting order puts it over the faded photo tail and under the type
            without a single z-index. ── */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-80 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background:
              'radial-gradient(85% 115% at 100% 100%, rgba(79,180,119,0.17), rgba(79,180,119,0.05) 40%, rgba(12,15,14,0) 70%)',
          }}
        />
        {/* Top sheen — faint light falling from above, as on the bundle tile. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.045),transparent)]"
        />

        {/* ── Text panel — overlaps onto the faded image tail on desktop.
            `relative` lifts it above the absolutely-positioned image layer,
            which otherwise paints over the panel's first characters. ── */}
        <div className="relative flex flex-col justify-center gap-3 p-5 sm:gap-4 sm:p-8 lg:ml-[48%] lg:h-full lg:w-[52%] lg:py-0 lg:pl-10 lg:pr-11">
          <p className="font-mono text-[12px] font-extrabold uppercase tracking-[0.2em] text-[#3FA35C]">
            {category} · {readMinutes} min read
          </p>
          <h3 className="text-pretty text-[26px] font-extrabold leading-[1.08] tracking-[-0.025em] text-white sm:text-[30px] lg:text-[40px]">
            {title}
          </h3>
          {/* Clamped on mobile so the block doesn't dominate the scroll. */}
          <p className="line-clamp-2 text-pretty text-[15px] leading-[1.55] text-[#9BA8A0] sm:line-clamp-none sm:text-[16px]">
            {excerpt}
          </p>
          <div className="mt-2 flex items-center gap-5">
            <span className="inline-flex h-[50px] items-center gap-2 whitespace-nowrap bg-[#3FA35C] px-[26px] text-[16px] font-extrabold text-[#08110B] transition-colors group-hover:bg-[#4CBB6B]">
              Read the guide
              <ArrowForwardIcon sx={{ fontSize: 20 }} />
            </span>
            {updated && (
              <span className="font-mono text-[12px] font-extrabold uppercase tracking-[0.16em] text-[#6D7A72]">
                Updated {updated}
              </span>
            )}
          </div>
        </div>
      </Link>
    </section>
  )
}
