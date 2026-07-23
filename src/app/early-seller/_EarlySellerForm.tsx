'use client'

/**
 * Early-seller waitlist form — client half of /early-seller. Collects the
 * minimal fields the beta campaign needs (username, email, optional Discord,
 * what they sell, an optional note) and posts through the submitEarlySeller
 * server action. On success it swaps the whole card for a confirmation state.
 */

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { CheckCircle2, Loader2, ArrowRight } from 'lucide-react'
import { GlassInput, GlassTextarea } from '@/components/ui/glass-input'
import { submitEarlySeller } from '@/lib/actions/early-seller'

const AMBER = '#F5C451'

export function EarlySellerForm() {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    const payload = {
      username: String(fd.get('username') ?? ''),
      email: String(fd.get('email') ?? ''),
      discord: String(fd.get('discord') ?? ''),
      sells: String(fd.get('sells') ?? ''),
      note: String(fd.get('note') ?? ''),
    }
    startTransition(async () => {
      const res = await submitEarlySeller(payload)
      if (res.ok) setDone(true)
      else setError(res.error ?? 'Something went wrong.')
    })
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-white/10 bg-bg-overlay/60 p-8 text-center backdrop-blur-xl sm:p-10">
        <div
          className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full"
          style={{ background: 'rgba(245,196,81,0.12)', color: AMBER }}
        >
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-bold text-white">You&apos;re On The List</h2>
        <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-text-secondary">
          Thanks for signing up. We&apos;ll reach out over email or Discord as we
          onboard the first sellers — keep an eye on your inbox.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-semibold text-text-secondary transition-colors hover:text-white"
        >
          Back to home
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    )
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border border-white/10 bg-bg-overlay/60 p-6 backdrop-blur-xl sm:p-8"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <GlassInput
          label="Username"
          name="username"
          required
          maxLength={60}
          placeholder="Your seller handle"
          autoComplete="username"
        />
        <GlassInput
          label="Email"
          name="email"
          type="email"
          required
          maxLength={160}
          placeholder="you@email.com"
          autoComplete="email"
        />
        <GlassInput
          label="Discord (Optional)"
          name="discord"
          maxLength={80}
          placeholder="username#0000 or @handle"
        />
        <GlassInput
          label="What Do You Sell? (Optional)"
          name="sells"
          maxLength={300}
          placeholder="e.g. Roblox items, Fortnite accounts"
        />
      </div>

      <div className="mt-4">
        <GlassTextarea
          label="Anything Else? (Optional)"
          name="note"
          maxLength={600}
          rows={3}
          placeholder="Tell us about your shop, volume, or where you sell today."
        />
      </div>

      {error && (
        <p className="mt-4 text-[13px] font-medium text-red-400">{error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-[14px] font-bold text-[#141414] transition-transform active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
        style={{ background: AMBER }}
      >
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Submitting…
          </>
        ) : (
          <>
            Claim My Spot
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>

      <p className="mt-3 text-center text-[11.5px] leading-relaxed text-text-tertiary">
        No commitment — this just reserves your place in the first-100 program.
      </p>
    </form>
  )
}
