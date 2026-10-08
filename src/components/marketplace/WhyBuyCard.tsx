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
  withArt = true,
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
  /** false: plain glass, no game art (the homepage has no single game). */
  withArt?: boolean
}) {
  const art = withArt ? await getGameCtaImage(gameSlug) : null
  const hasOffers = count > 0 && fromPrice != null
  // One self-explaining line each, no body copy (owner, 2026-10-06: "nobody
  // reads the sub text"). The offers line stays live.
  const why: Array<{ icon: string; title: string }> = [
    { icon: '/icons/set/shield-check.svg', title: 'Full Refund If It Never Arrives' },
    { icon: '/icons/set/clock.svg', title: 'Delivery Time Shown Before You Pay' },
    { icon: '/icons/set/verified.svg', title: 'Every Seller Is ID-Verified' },
    {
      icon: '/icons/set/tag.svg',
      title: hasOffers
        ? `${count} Live ${count === 1 ? 'Offer' : 'Offers'} From ${fromPrice}`
        : count > 0
          ? `${count} Live ${count === 1 ? 'Offer' : 'Offers'} to Compare`
          : 'Compare Real Seller Prices',
    },
    { icon: '/icons/set/messages.svg', title: 'Chat With Your Seller' },
    { icon: '/icons/set/support.svg', title: 'Real People Settle Disputes' },
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
      {art && <GuideBackdrop gameSlug={gameSlug} src={art} alt={`${subject} background art`} />}
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
        <ul className="mx-auto mt-7 grid max-w-5xl grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          {why.map((w) => (
            <li key={w.title} className="flex items-center gap-3">
              <SilverIcon src={w.icon} alt={`${w.title} icon`} className="h-6 w-6 shrink-0" />
              <p className="text-[15px] font-semibold leading-snug text-text-primary">{w.title}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
