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
  payoneer: '/payment-methods/payoneer.png',
  bank: '/payment-methods/bank.png',
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
  const mark = COIN_MARKS[key]

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
