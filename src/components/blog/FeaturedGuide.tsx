/**
 * Featured Guide block — the "5B" design from the marketplace banner handoff.
 *
 * A wide clickable row: cover photo on the left dissolving horizontally into a
 * dark text panel on the right (no divider line — the gradient IS the seam).
 * Below ~lg it stacks: image becomes a 16:9 band fading down into the panel.
 *
 * Card-surface system: the block is a raised card (bg-bg-raised, no outline)
 * and every fade end stop is that same colour (--color-bg-raised-rgb), so the
 * dissolve never opens a seam. The CTA is the brand primary button.
 */

import Link from '@/components/navigation/AppLink'
import { ArrowRightIcon } from '@phosphor-icons/react/dist/ssr/ArrowRight'
import { VALUE_BTN_PRIMARY } from '@/components/values/styles'

/** The card colour at an alpha — fade stops must equal the block background. */
const card = (a: number) => `rgba(var(--color-bg-raised-rgb), ${a})`

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
    return Number.isFinite(d.getTime()) ? UPDATED.format(d) : null
  })()

  return (
    <section className="pt-12 sm:pt-16">
      <h2 className="mb-4 text-subheading text-text-primary sm:text-heading">
        Featured Guide
      </h2>

      <Link
        href={href}
        // No hover background here: the photo dissolve's end stops are pinned
        // to the card colour, so shifting the block's bg would open a visible
        // seam in the gradient. The shadow + CTA carry the hover state instead.
        className="group relative block overflow-hidden rounded-lg bg-bg-raised shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)] transition-shadow duration-200 hover:shadow-[0_16px_40px_-12px_rgba(0,0,0,0.75)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring lg:h-[300px]"
      >
        {/* ── Image layer ── */}
        {/* Mobile: full-width 16:9 band. Desktop: absolute left half. */}
        <div className="relative aspect-video w-full overflow-hidden lg:absolute lg:inset-y-0 lg:left-0 lg:aspect-auto lg:h-full lg:w-[52%]">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote cover art
            <img
              src={cover}
              alt={title}
              aria-hidden
              // object-position ~35% (left of centre) so a centred-subject cover
              // pulls its pets into the visible left part of the panel instead
              // of hiding under the right-side fade — without clipping them off.
              className="h-full w-full object-cover [object-position:35%_center]"
            />
          ) : (
            <div className="h-full w-full bg-white/[0.04]" />
          )}
          {/* Horizontal fade into the panel (desktop) — starts melting the
              photo earlier so the dissolve reads clearly. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 hidden lg:block"
            style={{
              background: `linear-gradient(90deg, ${card(0.55)} 0%, ${card(0.15)} 34%, ${card(0.45)} 58%, ${card(0.85)} 78%, ${card(1)} 94%)`,
            }}
          />
          {/* Vertical fade — subtle on desktop, the dissolve on mobile. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background: `linear-gradient(180deg, ${card(0.5)} 0%, ${card(0)} 30%, ${card(0.55)} 78%, ${card(1)} 100%)`,
            }}
          />
          {/* Overlay label — the same flat tag as the grid card's category. */}
          <span className="pointer-events-none absolute left-5 top-5 rounded bg-black/55 px-2 py-0.5 text-[12px] font-semibold text-text-primary backdrop-blur-sm sm:left-[30px] sm:top-[26px]">
            Featured Guide
          </span>
        </div>

        {/* Top sheen — faint light falling from above. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.035),transparent)]"
        />

        {/* ── Text panel — overlaps onto the faded image tail on desktop.
            `relative` lifts it above the absolutely-positioned image layer,
            which otherwise paints over the panel's first characters. ── */}
        <div className="relative flex flex-col justify-center gap-2.5 p-5 sm:gap-3 sm:p-8 lg:ml-[48%] lg:h-full lg:w-[52%] lg:py-0 lg:pl-10 lg:pr-11">
          <p className="text-[13px] font-medium text-text-tertiary">
            {category} · {readMinutes} min read
          </p>
          <h3 className="text-pretty text-[24px] font-bold leading-[1.08] tracking-[-0.025em] text-text-primary sm:text-[27px] lg:text-[30px]">
            {title}
          </h3>
          {/* Clamped so the panel always fits the shorter card height. */}
          <p className="line-clamp-2 text-pretty text-[14px] leading-[1.5] text-text-secondary sm:text-[15px]">
            {excerpt}
          </p>
          <div className="mt-1 flex items-center gap-4">
            <span className={`${VALUE_BTN_PRIMARY} group-hover:bg-lime-hover`}>
              Read the Guide
              <ArrowRightIcon size={16} weight="bold" aria-hidden />
            </span>
            {updated && (
              <span className="text-[12px] font-medium text-text-tertiary">
                Updated {updated}
              </span>
            )}
          </div>
        </div>
      </Link>
    </section>
  )
}
