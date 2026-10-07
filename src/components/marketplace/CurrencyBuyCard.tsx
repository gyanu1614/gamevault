import Link from '@/components/navigation/AppLink'
import type { CSSProperties } from 'react'
import { BuyButtonFace } from '@/components/marketplace/BuyButton'

/**
 * The "Buy <Currency>" card at the top of a game hub. One component for every
 * game, so every currency card matches.
 *
 * Owner, 2026-10-06: the icon is the card's art, not a grey tile — a large,
 * floating copy of the currency icon on the right with a soft glow, the card
 * tinted and edged in the icon's own colour (Robux gold, V-Bucks blue) for a
 * glassy, 3D feel. The colour comes from the icon itself (getImageAccent), so
 * a new game needs no setting.
 *
 * Server component: the link and copy are in the HTML. Motion is CSS only
 * (`.cbc-coin`, globals.css) and off under reduced motion.
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
  return (
    <section
      aria-labelledby="hub-currency"
      className={['cbc group relative isolate overflow-hidden rounded-xl', className].filter(Boolean).join(' ')}
      style={{ '--cbc': rgb } as CSSProperties}
    >
      {/* Layers, back to front: ground, colour wash, glow, icon, sheen. */}
      <span aria-hidden className="cbc__ground absolute inset-0 -z-30" />
      {iconUrl && (
        // The icon as art: a blurred colour glow behind a floating copy.
        // Right edge on phones (faded, behind the copy), beside the button
        // from sm up.
        <span
          aria-hidden
          className="cbc__art pointer-events-none absolute -right-10 top-1/2 -z-10 h-[150px] w-[150px] -translate-y-1/2 opacity-25 sm:right-[15.5rem] sm:h-[168px] sm:w-[168px] sm:opacity-100"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- admin-uploaded currency icon */}
          <img src={iconUrl} alt="" className="cbc__glow absolute inset-[-30%] h-[160%] w-[160%] object-contain" />
          {/* eslint-disable-next-line @next/next/no-img-element -- admin-uploaded currency icon */}
          <img src={iconUrl} alt="" className="cbc-coin relative h-full w-full object-contain" />
        </span>
      )}
      <span aria-hidden className="cbc__sheen pointer-events-none absolute inset-0 -z-10" />

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
    </section>
  )
}
