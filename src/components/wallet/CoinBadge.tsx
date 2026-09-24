/**
 * Coin badge for payout methods.
 *
 * Replaces a lime-tinted tile that fell back to a generic building glyph for
 * any coin without a PNG in /public/payment-methods — which is why every USDT
 * rail rendered as an anonymous green icon.
 *
 * Two rules:
 *  • The tile is NEUTRAL. Lime is the product accent; painting a lime ring
 *    around every coin drowned the coins' own brand colours and made the
 *    picker read as one green wall.
 *  • Where no artwork exists we draw the asset's own mark in its own colour
 *    rather than substituting an unrelated icon. A wrong icon on a payout
 *    destination is worse than an honest lettermark.
 */

import Image from 'next/image'
import { cn } from '@/lib/utils'

/** Brand colour + mark for assets we have no PNG for. */
const COIN_MARKS: Record<string, { mark: string; fg: string; bg: string }> = {
  usdt: { mark: '₮', fg: '#FFFFFF', bg: '#26A17B' },
  usdc: { mark: '$', fg: '#FFFFFF', bg: '#2775CA' },
  btc: { mark: '₿', fg: '#FFFFFF', bg: '#F7931A' },
  eth: { mark: 'Ξ', fg: '#FFFFFF', bg: '#627EEA' },
}

/** PNGs that actually exist in /public/payment-methods. */
const COIN_ARTWORK: Record<string, string> = {
  btc: '/payment-methods/btc.png',
  eth: '/payment-methods/eth.png',
  usdc: '/payment-methods/usdc.png',
}

const FIAT_ARTWORK: Record<string, string> = {
  paypal: '/payment-methods/paypal.png',
  bank: '/payment-methods/bank.png',
}

/**
 * Fiat rails drawn as their own mark. Payoneer's mark is its gradient ring:
 * the PNG in /public is the stacked logo (ring over a dark wordmark), which at
 * badge size shrank to a smudge with an unreadable wordmark on the dark tile.
 * Stops sampled every 30° from that artwork, clockwise from 12 o'clock.
 */
const FIAT_RINGS: Record<string, string> = {
  payoneer:
    'conic-gradient(#EB9E00, #D6D805 30deg, #73D940 60deg, #1CD58F 90deg, #07A3D8 120deg, #5B77E7 150deg, ' +
    '#DB53CC 180deg, #EE4B61 210deg, #FC480C 240deg, #FF4700 270deg, #FE4800 300deg, #FB5200 330deg, #EB9E00)',
}

interface CoinBadgeProps {
  /** Asset ticker — btc | eth | usdt | usdc. Null for fiat. */
  coin?: string | null
  /** withdrawal_methods.method_name, used for fiat artwork. */
  methodName: string
  /** Dimmed for coming-soon rails. */
  muted?: boolean
  size?: number
  className?: string
}

export default function CoinBadge({
  coin,
  methodName,
  muted = false,
  size = 40,
  className,
}: CoinBadgeProps) {
  const key = (coin ?? '').toLowerCase()
  const artwork = COIN_ARTWORK[key] ?? FIAT_ARTWORK[methodName]
  const ring = key ? undefined : FIAT_RINGS[methodName]
  const mark = COIN_MARKS[key]
  // The ring fills the same box as the coin marks, with the logo's stroke
  // (7.7% of the diameter), never thinner than 2px.
  const ringSize = Math.round(size * 0.6)
  const ringStroke = Math.max(2, Math.round(ringSize * 0.077))
  const ringMask = `radial-gradient(farthest-side, transparent calc(100% - ${ringStroke}px - 0.5px), #000 calc(100% - ${ringStroke}px))`

  return (
    <span
      style={{ width: size, height: size }}
      className={cn(
        // Neutral surface so the coin's own colour is what the eye picks up.
        'flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border-subtle bg-bg-overlay',
        muted && 'opacity-60 grayscale',
        className,
      )}
    >
      {artwork ? (
        <Image
          src={artwork}
          alt=""
          width={Math.round(size * 0.55)}
          height={Math.round(size * 0.55)}
          className="object-contain"
        />
      ) : ring ? (
        <span
          aria-hidden
          style={{
            background: ring,
            width: ringSize,
            height: ringSize,
            WebkitMask: ringMask,
            mask: ringMask,
          }}
          className="rounded-full"
        />
      ) : mark ? (
        <span
          aria-hidden
          style={{
            background: mark.bg,
            color: mark.fg,
            width: Math.round(size * 0.62),
            height: Math.round(size * 0.62),
            fontSize: Math.round(size * 0.38),
          }}
          className="flex items-center justify-center rounded-full font-bold leading-none"
        >
          {mark.mark}
        </span>
      ) : (
        <span className="text-[11px] font-bold uppercase text-text-tertiary">
          {methodName.slice(0, 2)}
        </span>
      )}
    </span>
  )
}
