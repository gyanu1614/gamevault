'use client'

/**
 * BuyingOpensSoon — the checkout gate shown while PURCHASES_ENABLED is off.
 * Replaces the whole CheckoutForm: what they wanted to buy, an honest line,
 * and a notify-me email capture (buyer_waitlist). Dark-glass site theme.
 */

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, BellRing, Check, Loader2, Clock } from 'lucide-react'
import { submitBuyerWaitlist } from '@/lib/actions/buyer-waitlist'

export default function BuyingOpensSoon({
  listingId,
  listingTitle,
  price,
  currency,
  gameName,
  gameSlug,
  backHref,
}: {
  listingId: string
  listingTitle: string
  price: number
  currency: string
  gameName: string | null
  gameSlug: string | null
  backHref: string
}) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'saving' | 'done' | 'already'>('idle')
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setError(null)
    setState('saving')
    const res = await submitBuyerWaitlist({
      email,
      listingId,
      gameSlug,
      source: 'checkout-gate',
    })
    if (res.success) {
      setState(res.alreadyOnList ? 'already' : 'done')
    } else {
      setError(res.error ?? 'Something went wrong — please try again.')
      setState('idle')
    }
  }

  return (
    <div className="flex min-h-[70vh] w-full items-center justify-center px-4 py-16">
      <div className="w-full max-w-[520px] rounded-xl border border-white/10 bg-white/[0.04] p-8 sm:p-10">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-lime-400/30 bg-lime-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-lime-300">
          <Clock className="h-3 w-3" />
          Coming Soon
        </span>

        <h1 className="mt-4 text-[26px] font-bold tracking-tight text-white">
          Buying Opens Soon
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-white/60">
          We&rsquo;re putting the finishing touches on payments. Listings are live —
          checkout unlocks shortly.
        </p>

        {/* What they wanted */}
        <div className="mt-5 flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold text-white">{listingTitle}</p>
            {gameName && <p className="mt-0.5 text-[12px] text-white/50">{gameName}</p>}
          </div>
          <span className="shrink-0 text-[15px] font-bold text-lime-300">
            ${price.toFixed(2)} <span className="text-[11px] font-medium text-white/40">{currency}</span>
          </span>
        </div>

        {/* Notify me */}
        {state === 'done' || state === 'already' ? (
          <div className="mt-5 flex items-center gap-2.5 rounded-lg border border-lime-400/25 bg-lime-400/10 px-4 py-3.5">
            <Check className="h-4 w-4 shrink-0 text-lime-300" strokeWidth={2.5} />
            <p className="text-[13.5px] text-lime-100">
              {state === 'already'
                ? 'You’re already on the list — we’ll email you at launch.'
                : 'You’re on the list — we’ll email you the moment buying opens.'}
            </p>
          </div>
        ) : (
          <div className="mt-5">
            <label className="mb-1.5 block text-[12.5px] font-medium text-white/70">
              Get Notified At Launch
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void submit() }}
                placeholder="you@example.com"
                className="h-[46px] min-w-0 flex-1 rounded-lg border border-white/15 bg-black/30 px-3.5 text-[15px] text-white outline-none transition-colors placeholder:text-white/30 focus:border-lime-400/60"
              />
              <button
                type="button"
                onClick={() => void submit()}
                disabled={state === 'saving'}
                className="inline-flex h-[46px] shrink-0 items-center gap-2 rounded-lg bg-lime-400 px-4 text-[14px] font-bold text-[#0F3320] transition-[filter] hover:brightness-110 disabled:opacity-70"
              >
                {state === 'saving' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <BellRing className="h-4 w-4" />
                )}
                Notify Me
              </button>
            </div>
            {error && <p className="mt-2 text-[12.5px] font-medium text-red-400">{error}</p>}
          </div>
        )}

        <Link
          href={backHref}
          className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-white/50 transition-colors hover:text-white/80"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back To Listing
        </Link>
      </div>
    </div>
  )
}
