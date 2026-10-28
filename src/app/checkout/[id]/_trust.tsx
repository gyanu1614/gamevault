/**
 * Checkout trust layer (owner 2026-10-21: "a buyer can trust the site and
 * click checkout without hesitating"). Every line here is a true statement
 * about how DropMarket works; nothing imitates a third party's seal or score.
 *
 *   TrustSeals     — under the payment methods: SafeDrop, SSL, licensed payments
 *   BuyerRating    — real average of visible buyer reviews (hidden below 10)
 *   TrustList      — beside the Pay button: seller chat, delivery, support
 *   CheckoutFooter — company identity + legal links, full width
 *
 * Icons: Phosphor duotone, small and in a soft trust blue (owner 2026-10-21:
 * subtle, no circles); the brand green stays on Pay and the picked method.
 */

import Link from '@/components/navigation/AppLink'
import type { Icon as PhosphorIcon } from '@phosphor-icons/react'
import { ChatsCircle } from '@phosphor-icons/react/dist/ssr/ChatsCircle'
import { Lightning } from '@phosphor-icons/react/dist/ssr/Lightning'
import { Headset } from '@phosphor-icons/react/dist/ssr/Headset'
import { ShieldCheck } from '@phosphor-icons/react/dist/ssr/ShieldCheck'
import { LockKey } from '@phosphor-icons/react/dist/ssr/LockKey'
import { CreditCard } from '@phosphor-icons/react/dist/ssr/CreditCard'
import { Star } from '@phosphor-icons/react/dist/ssr/Star'
import { StarHalf } from '@phosphor-icons/react/dist/ssr/StarHalf'

import type { SiteRating } from '@/lib/reviews/site-rating'
import { cn } from '@/lib/utils'
import { FLAT_BOX_CLASS, PANEL_CLASS, PANEL_STYLE, TRUST_BLUE } from './_surfaces'

/** Trust blue: the security signals only; brand green stays on Pay. */
export { TRUST_BLUE }
const STAR = '#F5B83D'

const SEALS: Array<{ Icon: PhosphorIcon; title: string; sub: string }> = [
  { Icon: ShieldCheck, title: 'SafeDrop Protection', sub: 'Money back if not delivered' },
  { Icon: LockKey, title: 'SSL Encrypted', sub: '256-bit secure checkout' },
  { Icon: CreditCard, title: 'Trusted Payments', sub: 'Bank, wallet and crypto' },
]

/** The three seals under the payment list (owner 2026-10-27): one flat box
 *  like the payment rows above it, three cells split by hairlines (stacked
 *  on phones). Icons: crisp solid glyphs in a small trust-blue tile, the
 *  way professional checkouts mark security (Baymard: a plain padlock and
 *  short "secured" copy beat ornate seals); never 3D clip-art. */
export function TrustSeals() {
  return (
    <ul aria-label="Payment security" className={cn(FLAT_BOX_CLASS, 'grid grid-cols-1 overflow-hidden sm:grid-cols-3')}>
      {SEALS.map(({ Icon, title, sub }, i) => (
        <li
          key={title}
          className={cn('flex items-center gap-3 px-4 py-3.5', i > 0 && 'border-t border-white/[0.06] sm:border-l sm:border-t-0')}
        >
          <span
            aria-hidden
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md"
            style={{ background: 'rgba(106,168,255,0.12)' }}
          >
            <Icon size={17} weight="fill" color={TRUST_BLUE} />
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] font-semibold leading-snug text-[#E9EDF2]">{title}</span>
            <span className="block text-[12px] leading-snug text-[#9AA6B3]">{sub}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Stars filled to the nearest half of the real average. */
function Stars({ value }: { value: number }) {
  const halves = Math.round(value * 2)
  return (
    <span className="flex items-center gap-0.5" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => {
        const left = halves - i * 2
        return left === 1 ? (
          <StarHalf key={i} size={18} weight="fill" color={STAR} />
        ) : (
          <Star key={i} size={18} weight={left >= 2 ? 'fill' : 'regular'} color={STAR} />
        )
      })}
    </span>
  )
}

export function BuyerRating({ rating }: { rating: SiteRating | null }) {
  if (!rating) return null
  return (
    <div
      className={cn(PANEL_CLASS, 'flex items-center gap-3 px-5 py-3.5')}
      style={PANEL_STYLE}
      aria-label={`Buyer rating ${rating.average} out of 5 from ${rating.count} reviews`}
    >
      <span className="min-w-0">
        <span className="block text-[14px] font-semibold text-[#E9EDF2]">Buyer Rating</span>
        <span className="block text-[12px] text-[#9AA6B3]">From {rating.count.toLocaleString('en-US')} buyer reviews</span>
      </span>
      <span className="ml-auto flex items-center gap-2">
        <Stars value={rating.average} />
        <span className="text-[13px] font-semibold tabular-nums text-[#E9EDF2]">
          {rating.average.toFixed(1)}
          <span className="font-normal text-[#9AA6B3]"> / 5</span>
        </span>
      </span>
    </div>
  )
}

const LIST: Array<{ Icon: PhosphorIcon; title: string; sub: string }> = [
  { Icon: ChatsCircle, title: 'Chat With Your Seller', sub: 'Every order has its own chat.' },
  { Icon: Lightning, title: 'Fast Delivery', sub: 'Most orders arrive within minutes.' },
  { Icon: Headset, title: '24/7 Human Support', sub: 'Real people, any time you need help.' },
]

export function TrustList() {
  return (
    <ul className={cn(PANEL_CLASS, 'flex flex-col gap-3.5 px-5 py-4')} style={PANEL_STYLE}>
      {LIST.map(({ Icon, title, sub }) => (
        <li key={title} className="flex items-start gap-3">
          <Icon aria-hidden size={20} weight="duotone" color={TRUST_BLUE} className="mt-[1px] shrink-0" />
          <span className="min-w-0">
            <span className="block text-[13.5px] font-semibold leading-snug text-[#E9EDF2]">{title}</span>
            <span className="block text-[12px] leading-snug text-[#9AA6B3]">{sub}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

const LEGAL = [
  { href: '/terms', label: 'Terms of Use' },
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/refunds', label: 'Refund Policy' },
  { href: '/cookies', label: 'Cookie Policy' },
]

/** Full-width company bar (Eldorado pattern, our data). */
export function CheckoutFooter() {
  return (
    <footer className="border-t border-white/[0.06] bg-[#131417]">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-3 px-3 py-6 text-center sm:px-6 lg:flex-row lg:justify-between lg:px-8 lg:text-left">
        <div>
          <p className="text-body-sm text-[#9AA6B3]">© {new Date().getFullYear()} DropMarket Ltd. All rights reserved.</p>
          <p className="mt-0.5 text-[12.5px] text-[#6C7684]">Registered in the United Kingdom · Company No. 17309867</p>
        </div>
        <nav aria-label="Legal" className="flex flex-wrap justify-center gap-x-5 gap-y-1.5 text-body-sm text-[#9AA6B3]">
          {LEGAL.map((l) => (
            <Link key={l.href} href={l.href} className="transition-colors hover:text-[#E9EDF2]">
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
      {/* clearance for the mobile sticky pay bar */}
      <div className="h-20 lg:hidden" />
    </footer>
  )
}
