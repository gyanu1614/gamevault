import Link from '@/components/navigation/AppLink'
import { BuyButtonFace } from '@/components/marketplace/BuyButton'
import { MARKET_CARD } from '@/lib/ui/surfaces'
import { cn } from '@/lib/utils'
import { CurrencyCoinArt } from './CurrencyCoinArt'

/**
 * The "Buy <Currency>" card at the top of a game hub. One component for every
 * game, so every currency card matches.
 *
 * Owner, 2026-10-06: the icon is the card's art, not a grey tile. The card is
 * the standard marketplace surface (no outline, no coloured glow — tried and
 * rejected the same day); the icon sits large on the right, half off the
 * edge, and tilts toward the pointer (CurrencyCoinArt, Framer Motion). Only
 * the eyebrow takes the icon's colour (getImageAccent), so every game's card
 * matches its own currency without a setting.
 *
 * Server component for the copy and link (in the HTML); the art is the one
 * client island.
 */
export function CurrencyBuyCard({
  gameName,
  name,
  href,
  iconUrl,
  accent,
  fromLabel,
  count,
  avgDelivery,
  className,
}: {
  gameName: string
  /** "Robux", "V-Bucks". */
  name: string
  href: string
  iconUrl: string | null
  /** "r,g,b" from getImageAccent; neutral when null. */
  accent: string | null
  fromLabel: string | null
  count: number
  avgDelivery: string | null
  className?: string
}) {
  const rgb = accent ?? '233,237,242'
  const body = (
      <div className="flex min-h-[176px] flex-col justify-center gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div className="min-w-0 max-w-[30rem]">
          <p className="text-[13px] font-semibold uppercase tracking-[0.08em]" style={{ color: `rgb(${rgb})` }}>
            {gameName} Currency
          </p>
          <h2 id="hub-currency" className="mt-1.5 text-[26px] font-bold leading-tight tracking-[-0.02em] text-text-primary sm:text-[30px]">
            Buy {name}
          </h2>
          <p className="mt-1.5 text-[14px] text-text-secondary">
            {fromLabel ? (
              <>
                From <span className="font-semibold tabular-nums text-text-primary">{fromLabel}</span>
                <span aria-hidden className="mx-1.5 text-text-tertiary">·</span>
                {count.toLocaleString('en-US')} {count === 1 ? 'Offer' : 'Offers'}
                {avgDelivery && (
                  <>
                    <span aria-hidden className="mx-1.5 text-text-tertiary">·</span>
                    Delivered in about {avgDelivery}
                  </>
                )}
              </>
            ) : (
              'Offers are opening soon.'
            )}
          </p>
        </div>
        <Link
          href={href}
          className="relative shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          <BuyButtonFace size="lg" className="w-full sm:w-auto sm:min-w-[180px]">
            Buy {name}
          </BuyButtonFace>
        </Link>
      </div>
  )

  return (
    <section aria-labelledby="hub-currency" className={cn('relative isolate overflow-hidden rounded-xl', MARKET_CARD, className)}>
      {iconUrl ? (
        <CurrencyCoinArt src={iconUrl} className="relative">
          <div className="relative">{body}</div>
        </CurrencyCoinArt>
      ) : (
        body
      )}
    </section>
  )
}
