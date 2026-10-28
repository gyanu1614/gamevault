/**
 * Checkout trust layer (owner 2026-10-21: "a buyer can trust the site and
 * click checkout without hesitating"). Every line here is a true statement
 * about how DropMarket works; nothing imitates a third party's seal or score.
 *
 *   TrustSeals     — under the payment methods: SafeDrop, secure payment, the methods
 *   BuyerRating    — real average of visible buyer reviews (hidden below 10)
 *   CheckoutFooter — company identity + legal links, full width
 *
 * Icons: Phosphor, in a soft trust blue; the brand green stays on Pay.
 */

import Image from 'next/image'
import Link from '@/components/navigation/AppLink'
import type { Icon as PhosphorIcon } from '@phosphor-icons/react'
import { ShieldCheck } from '@phosphor-icons/react/dist/ssr/ShieldCheck'
import { LockKey } from '@phosphor-icons/react/dist/ssr/LockKey'
import { CreditCard } from '@phosphor-icons/react/dist/ssr/CreditCard'
import { Star } from '@phosphor-icons/react/dist/ssr/Star'
import { StarHalf } from '@phosphor-icons/react/dist/ssr/StarHalf'
import type { ReactNode } from 'react'

import type { MethodMark } from '@/lib/payments/method-marks'
import type { SiteRating } from '@/lib/reviews/site-rating'
import { cn } from '@/lib/utils'
import { PANEL_CLASS, PANEL_STYLE, TRUST_BLUE } from './_surfaces'

/** Trust blue: the security signals only; brand green stays on Pay. */
export { TRUST_BLUE }
const STAR = '#F5B83D'

/** The seal logos: our on-dark marks, greyed to one quiet tone. */
const LOGO_HEIGHT = 11
const LOGO_GREY = 'grayscale(1) brightness(1.6) opacity(0.6)'

function Seal({ Icon, title, children }: { Icon: PhosphorIcon; title: string; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[rgba(106,168,255,0.12)]">
        <Icon size={17} weight="fill" color={TRUST_BLUE} />
      </span>
      <span className="min-w-0">
        <span className="block text-[13.5px] font-semibold leading-snug text-[#E9EDF2]">{title}</span>
        <span className="mt-0.5 block text-[12.5px] leading-snug text-[#9AA6B3]">{children}</span>
      </span>
    </li>
  )
}

/**
 * The three seals under the payment list (owner 2026-10-27): no box, the
 * three float in a row on wide screens (each column as wide as its words)
 * and stack on phones and beside the narrow lg column. Copy: the SafeDrop
 * promise in the buyer's words, the industry-standard "Secure Payment /
 * 256-bit SSL encryption" pair (Baymard: a plain padlock and "secured"
 * copy beat ornate seals), and the ways this buyer can pay as grey marks
 * plus "+N More" (`sealMarks`).
 */
export function TrustSeals({ marks, more }: { marks: MethodMark[]; more: number }) {
  return (
    <ul
      aria-label="Payment Security"
      className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-[auto_auto_auto] md:justify-between lg:grid-cols-1 xl:grid-cols-[auto_auto_auto]"
    >
      <Seal Icon={ShieldCheck} title="SafeDrop Protection">
        Get your order or 100% money back
      </Seal>
      <Seal Icon={LockKey} title="Secure Payment">
        256-bit SSL encryption
      </Seal>
      <Seal Icon={CreditCard} title="Payment Methods">
        <span className="mt-1 flex items-center gap-1.5">
          {marks.map((m) => (
            <Image
              key={m.logo}
              src={m.logo}
              alt=""
              width={Math.round(LOGO_HEIGHT * m.aspect)}
              height={LOGO_HEIGHT}
              unoptimized
              className="shrink-0"
              style={{ filter: LOGO_GREY, height: LOGO_HEIGHT, width: 'auto' }}
            />
          ))}
          {more > 0 && <span className="whitespace-nowrap text-[12px] font-medium">+{more} More</span>}
        </span>
      </Seal>
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
