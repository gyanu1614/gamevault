/**
 * "Accepted at Checkout": a full-bleed strip of the payment methods the
 * checkout really offers, each as its brand mark on a small white tile (the
 * same tile the checkout selector uses). Built from the Payssion registry
 * plus the crypto card's coins, so a method can't appear here unless a buyer
 * can pick it. Owner, 2026-10-05: the old stylised wordmarks (Visa, Klarna,
 * Skrill…) were "random", not what we take, and the strip sat too far from
 * the content above.
 *
 * Duplicated track + the `animate-marquee` keyframe (reversed, left →
 * right); pauses on hover. Render OUTSIDE any max-w wrapper.
 */

import { payssionSelectorMethods } from '@/lib/payments/providers/payssion/methods'
import { CHECKOUT_COINS, PAYMENT_METHOD_LOGOS } from '@/lib/payments/method-marks'

interface Mark {
  key: string
  label: string
  logo?: string
  /** Coin icons are square: they sit beside their name. */
  coin?: boolean
}

const MARKS: Mark[] = [
  ...CHECKOUT_COINS.map((c) => ({ key: c.key, label: c.label, logo: c.icon, coin: true })),
  ...payssionSelectorMethods().map((m) => ({ key: m.pmId, label: m.label, logo: PAYMENT_METHOD_LOGOS[m.pmId] })),
]

function Tile({ mark }: { mark: Mark }) {
  return (
    <span className="flex h-10 w-[92px] shrink-0 select-none items-center justify-center gap-1.5 overflow-hidden rounded-md bg-white px-2.5 shadow-[0_1px_0_rgba(255,255,255,0.08),0_6px_16px_-8px_rgba(0,0,0,0.7)] sm:h-11 sm:w-[100px]">
      {mark.logo ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- static brand marks in /public */}
          <img
            src={mark.logo}
            alt=""
            loading="lazy"
            decoding="async"
            className={mark.coin ? 'h-5 w-5 shrink-0' : 'h-full max-h-[26px] w-full object-contain'}
          />
          {mark.coin && <span className="text-[13px] font-bold tracking-tight text-[#16171B]">{mark.label}</span>}
        </>
      ) : (
        <span className="text-[13px] font-extrabold tracking-tight text-[#16171B]">{mark.label}</span>
      )}
    </span>
  )
}

export function PaymentsMarquee() {
  return (
    <section aria-labelledby="payments-strip-title" className="group relative mt-10 w-full overflow-hidden pb-2 pt-2 sm:mt-14">
      <h2 id="payments-strip-title" className="mb-4 text-center text-[13px] font-medium text-text-tertiary">
        Accepted at Checkout
      </h2>
      {/* Screen readers get the list once, in plain words. */}
      <p className="sr-only">{MARKS.map((m) => m.label).join(', ')}</p>

      <div className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-bg-base to-transparent sm:w-32"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-bg-base to-transparent sm:w-32"
        />
        <div
          aria-hidden
          className="flex w-max animate-marquee items-center py-1 [animation-direction:reverse] group-hover:[animation-play-state:paused] motion-reduce:animate-none"
        >
          {[0, 1].map((t) => (
            <div key={t} className="flex shrink-0 items-center gap-3 pr-3">
              {MARKS.map((m) => (
                <Tile key={`${t}-${m.key}`} mark={m} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
