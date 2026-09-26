/**
 * CategoryGuide — the editorial SEO section at the bottom of a marketplace
 * category page (`/[game]/[category]`), after the listings end. The
 * Eldorado / GameBoost pattern: listings first for the shopper, then a
 * substantial guide for search and for the buyer still deciding.
 *
 * Three parts:
 *   1. Curated guide — game-specific editorial from
 *      `src/content/category-guides`. Only rendered when an entry exists.
 *   2. Why Buy — shared, but carries the page's LIVE stats (listing count,
 *      from-price) so it is never a static boilerplate claim.
 *   3. How to Buy — the homepage's 4-step cards, with a short line per step;
 *      the guide can override the title and step 1's line.
 * How to Buy is the homepage's 4-step section (BuyerSteps) reused as its
 * own section below, with a game-specific title.
 *
 * Server component: all copy is in the initial HTML, which is what search
 * engines index. No client JS.
 *
 * COPY RULE (no-escrow memory): describe the ORDER and the guarantee, never
 * when money moves between buyer, us and seller.
 */

import Link from 'next/link'
import type { ReactNode } from 'react'

import { SilverIcon } from '@/components/ui/silver-icon'
import { BuyerSteps } from '@/features/home/components/BuyerSteps'
import { gameCtaArt } from '@/lib/content/game-cta-art'
import { GuideBackdrop } from './GuideBackdrop'
import { getCategoryGuide, type GuideBlock, type GuideText } from '@/content/category-guides'
import { formatStatPrice, type CategoryStats } from '@/lib/seo/page-stats'

// ─── Inline markup: `[text](/href)` and `**bold**` ──────────────────────────

const TOKEN = /(\[[^\]]+\]\([^)\s]+\)|\*\*[^*]+\*\*)/g

/**
 * Renders guide text to React nodes. Deliberately tiny — two constructs,
 * never raw HTML, so guide files cannot inject markup. Links are only
 * honoured for site-relative paths; anything else renders as plain text.
 */
function renderText(text: GuideText): ReactNode[] {
  return text.split(TOKEN).map((part, i) => {
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part)
    if (link) {
      const [, label, href] = link
      if (!href.startsWith('/')) return label
      return (
        <Link
          key={i}
          href={href}
          className="font-medium text-[var(--color-accent-text)] underline decoration-[color-mix(in_srgb,var(--color-accent-text)_40%,transparent)] underline-offset-[3px] transition-colors hover:decoration-[var(--color-accent-text)]"
        >
          {label}
        </Link>
      )
    }
    const bold = /^\*\*([^*]+)\*\*$/.exec(part)
    if (bold) {
      return (
        <strong key={i} className="font-semibold text-text-primary">
          {bold[1]}
        </strong>
      )
    }
    return part
  })
}

function Block({ block }: { block: GuideBlock }) {
  if (block.type === 'list') {
    return (
      <ul className="list-disc space-y-0.5 pl-5 marker:text-white/50">
        {block.items.map((item, i) => (
          <li key={i}>{renderText(item)}</li>
        ))}
      </ul>
    )
  }
  return <p>{renderText(block.text)}</p>
}

// ─── Shared content ─────────────────────────────────────────────────────────

function plural(n: number, one: string, many: string) {
  return n === 1 ? one : many
}

export function CategoryGuide({
  gameSlug,
  categorySlug,
  gameName,
  categoryName,
  stats,
}: {
  gameSlug: string
  categorySlug: string
  gameName: string
  categoryName: string
  stats: CategoryStats
}) {
  const guide = getCategoryGuide(gameSlug, categorySlug)
  const subject = `${gameName} ${categoryName}`
  const hasOffers = stats.count > 0 && stats.lowPrice != null
  const fromPrice = stats.lowPrice != null ? `$${formatStatPrice(stats.lowPrice)}` : null

  const why: Array<{ icon: string; title: string; body: string }> = [
    {
      icon: '/icons/set/shield-check.svg',
      title: 'SafeDrop Protection',
      body: 'Every order is covered. If it doesn’t arrive, or isn’t what the listing described, you get a full refund.',
    },
    {
      icon: '/icons/set/clock.svg',
      title: 'Delivery Time Up Front',
      body: 'Each listing shows the seller’s own delivery time before you pay. Most orders arrive within 20 minutes.',
    },
    {
      icon: '/icons/set/verified.svg',
      title: 'Verified Sellers',
      body: 'Every seller completes identity verification before they can list, and their rating and order history show on every listing.',
    },
    {
      icon: '/icons/set/tag.svg',
      title: 'Compare Real Offers',
      body: hasOffers
        ? `${stats.count} live ${plural(stats.count, 'listing', 'listings')} from ${fromPrice}. Sellers set their own prices, so you choose by price, speed or rating.`
        : 'Sellers set their own prices, so you choose by price, speed or rating.',
    },
    {
      icon: '/icons/set/messages.svg',
      title: 'Order Chat',
      body: 'Talk to your seller directly from the order page to arrange delivery.',
    },
    {
      icon: '/icons/set/support.svg',
      title: 'Disputes Handled by People',
      body: 'If something goes wrong, open a dispute from your order and our team reviews it.',
    },
  ]

  // COMPACT on purpose. This is reference copy under a full page of
  // listings — most visitors never read it, so it takes as little room as
  // it can: body at 14px, headings one step up and bold, sections separated
  // by a single line of space, heading-to-text gap nearly zero (the dense
  // Eldorado pattern). Body text is white, not the muted secondary grey.
  // Three clear levels, not three near-identical ones: the guide title
  // (28px), section headings (18px, bold) and body (14px). Headings are
  // pure white; body is a softer white so the headings stand out from it
  // instead of reading as more of the same text.
  const title = 'text-heading font-bold tracking-[-0.015em] text-text-primary [text-wrap:balance]'
  const h2 = 'text-subheading font-bold text-text-primary [text-wrap:balance]'
  const h3 = 'text-body-lg font-bold text-text-primary'
  const prose = 'text-body-sm leading-[1.65] text-[rgba(233,237,242,0.8)]'

  // Short line under each of the four steps. Step 1 names what the buyer
  // is choosing ("Choose your pet" on Adopt Me, "Choose your item" by
  // default). Copy rule: the ORDER's state only, never when money moves.
  const stepSubs: [string, string, string, string] = [
    guide?.howToBuy?.choose ?? 'Choose Your Item',
    'Every Order Has a Delivery Time',
    'Receive In-Game and Confirm',
    'Issue or Not Received? 100% Refund',
  ]

  return (
    // Two sections, one column. The wrapper owns the spacing between them
    // and above them (sections carry no margins of their own), and each
    // section opts into the standard page measure itself.
    <div className="mt-12 flex flex-col gap-16 pb-16 sm:mt-16 sm:gap-20 sm:pb-24">
      <section aria-labelledby="category-guide-title" className="page-measure">
        {/* ── Curated guide — full measure, left to right ─────────────── */}
        {guide && (
          <article className="space-y-6">
            <div>
              <h2 id="category-guide-title" className={title}>
                {guide.title}
              </h2>
              <div className={`mt-3 space-y-2 ${prose}`}>
                {guide.intro.map((t, i) => (
                  <p key={i}>{renderText(t)}</p>
                ))}
              </div>
            </div>

            {guide.sections.map((section) => (
              <div key={section.heading}>
                <h3 className={h3}>{section.heading}</h3>
                <div className={`mt-1.5 space-y-2 ${prose}`}>
                  {section.blocks.map((b, i) => (
                    <Block key={i} block={b} />
                  ))}
                </div>
              </div>
            ))}

            {/* Related pages as a plain line — internal links matter for
                search, but they don't need a box. */}
            {guide.related && guide.related.length > 0 && (
              <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-body-sm">
                <span className="font-bold text-text-primary">Explore:</span>
                {guide.related.map((r) => (
                  <Link
                    key={r.href}
                    href={r.href}
                    className="text-[var(--color-accent-text)] underline decoration-[color-mix(in_srgb,var(--color-accent-text)_40%,transparent)] underline-offset-[3px] transition-colors hover:decoration-[var(--color-accent-text)]"
                  >
                    {r.label}
                  </Link>
                ))}
              </p>
            )}
          </article>
        )}

        {/* ── Why Buy — a card with the game's own art behind it ────────
            Same art as the game's hub sell band (shared helper), so the page
            and the hub read as one family. Stack, per the CLAUDE.md artwork
            rules: the image carries its own normalising filter, then ONE
            wash reaching the page-base token — even across the card (the
            text spans the full width) and heavier toward the bottom, where
            promo art tends to carry its own lettering. If the game has no
            art, the backdrop hides itself and the card is plain glass. */}
        <div
          // Space ABOVE the card matches the space BELOW it (the wrapper's
          // gap to How to Buy), so the card sits evenly between the two.
          className={`relative overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.02] shadow-[inset_0_1px_0_rgba(233,237,242,0.07)] ${guide ? 'mt-16 sm:mt-20' : ''}`}
        >
          <GuideBackdrop src={gameCtaArt(gameSlug)} />
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, color-mix(in srgb, var(--color-bg-base) 68%, transparent) 0%, color-mix(in srgb, var(--color-bg-base) 76%, transparent) 60%, color-mix(in srgb, var(--color-bg-base) 90%, transparent) 100%)',
            }}
          />

          <div className="relative px-5 py-7 sm:px-10 sm:py-9">
            <h2
              // Without a curated guide this is the section's first heading,
              // so it takes over the landmark's label.
              id={guide ? undefined : 'category-guide-title'}
              className={`${h2} text-center`}
            >
              Why Buy {subject} on DropMarket
            </h2>
            <ul className="mx-auto mt-6 grid max-w-6xl gap-x-10 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
              {why.map((w) => (
                <li key={w.title} className="flex gap-3">
                  <SilverIcon src={w.icon} className="mt-0.5 h-5 w-5 shrink-0" />
                  <div className="min-w-0 text-body-sm leading-[1.5]">
                    <p className="font-bold text-text-primary">{w.title}</p>
                    {/* Explicit rgba, not `text-text-primary/85`: that token is a bare
                        var(), so an opacity modifier compiles to nothing. */}
                    <p className="text-[rgba(233,237,242,0.88)]">{w.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── How to Buy — the homepage's 4-step section, reused ─────────
          Same component as the homepage (numerals behind glass cards,
          rim light), with a game-specific title and one short line per
          step. It brings its own `.page-measure`. */}
      <BuyerSteps
        title={guide?.howToBuy?.title ?? `How to Buy ${subject}`}
        // No line under the title here — the steps speak for themselves.
        subtitle={null}
        subs={stepSubs}
      />
    </div>
  )
}
