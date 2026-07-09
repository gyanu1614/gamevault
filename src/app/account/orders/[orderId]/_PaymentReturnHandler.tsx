'use client'

/**
 * Handles the post-payment return from CoinGate (success_url = …?paid=1).
 *
 * Two things, on mount when `?paid=1` is present:
 *   1. COLLAPSE HISTORY — replace the current history entry (the one we landed
 *      on coming back from CoinGate) with the clean order URL. This makes the
 *      browser Back button skip the CoinGate invoice page (which otherwise sits
 *      in history and is confusing to return to after paying).
 *   2. Show a subtle "Payment received — confirming…" toast. The order's paid
 *      status is set by the verified CoinGate webhook (the source of truth),
 *      not by this redirect, so we don't claim "paid" here — just acknowledge
 *      the payment landed while the webhook confirms (seconds).
 *
 * Renders nothing.
 */

import { useEffect, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'

export function PaymentReturnHandler() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const handledRef = useRef(false)

  useEffect(() => {
    if (handledRef.current) return
    if (searchParams?.get('paid') !== '1') return
    handledRef.current = true

    // Replace the current entry with the clean URL (no ?paid=1). Using
    // router.replace collapses the payment-return history entry, so Back goes
    // to wherever the buyer was BEFORE checkout — never back to CoinGate.
    router.replace(pathname)

    toast.success('Payment received', {
      description: 'Confirming your order — this usually takes a few seconds.',
    })
  }, [searchParams, pathname, router])

  return null
}
