import { SilverIcon } from '@/components/ui/silver-icon'
import { getGameCtaImage } from '@/lib/content/game-cta-art.server'
import { GuideBackdrop } from './GuideBackdrop'

/**
 * "Why Buy <subject> on DropMarket": six reasons over the game's own CTA art.
 * Shared by the bottom of every category page (CategoryGuide) and the game
 * hub (owner, 2026-10-06: the hub gets the items page's section, for SEO).
 * The "Compare Real Offers" line carries the page's LIVE count and from-price,
 * so it is never a static boilerplate claim.
 *
 * Stack, per the artwork rules: the image carries its own normalising
 * filter, then ONE wash reaching the page-base token, heavier toward the
 * bottom. With no art the backdrop hides itself and the card is plain glass.
 * Server component, no client JS.
 */
export async function WhyBuyCard({
  gameSlug,
  subject,
  count,
  fromPrice,
  headingId,
  className,
}: {
  gameSlug: string
  /** "Roblox Items", or just "Roblox" on the hub. */
  subject: string
  /** Live offers behind the "Compare Real Offers" line. */
  count: number
  /** "$4" — the cheapest live offer, or null. */
  fromPrice: string | null
  headingId?: string
  className?: string
}) {
  const art = await getGameCtaImage(gameSlug)
  const hasOffers = count > 0 && fromPrice != null
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
        ? `${count} live ${count === 1 ? 'listing' : 'listings'} from ${fromPrice}. Sellers set their own prices, so you choose by price, speed or rating.`
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

  return (
    <div
      className={[
        'relative overflow-hidden rounded-xl bg-[#1A1B1F] shadow-[inset_0_1px_0_rgba(233,237,242,0.07)]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <GuideBackdrop gameSlug={gameSlug} src={art} />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, color-mix(in srgb, var(--color-bg-base) 68%, transparent) 0%, color-mix(in srgb, var(--color-bg-base) 76%, transparent) 60%, color-mix(in srgb, var(--color-bg-base) 90%, transparent) 100%)',
        }}
      />
      <div className="relative px-5 py-7 sm:px-10 sm:py-9">
        <h2 id={headingId} className="text-center text-subheading font-bold text-text-primary [text-wrap:balance]">
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
  )
}
