/**
 * P5.2 — Buyer Loyalty & Cashback Dashboard
 *
 * Server component: fetches loyalty stats and renders the page.
 */

import { getLoyaltyStats } from '@/lib/actions/loyalty'

// Display-only rate (matches LOYALTY_CASHBACK_RATE default in loyalty.ts)
const LOYALTY_CASHBACK_RATE = parseFloat(process.env.LOYALTY_CASHBACK_RATE || '0.02')
import LoyaltyClient from './LoyaltyClient'

export const metadata = {
  title: 'Rewards & Cashback',
  description: 'Earn cashback on every purchase and track your loyalty rewards.',
}

export default async function LoyaltyPage() {
  const result = await getLoyaltyStats()

  if (!result.success || !result.data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <p className="text-text-secondary mb-2">Could not load loyalty data.</p>
          <p className="text-sm text-text-disabled">{result.error}</p>
        </div>
      </div>
    )
  }

  return (
    <LoyaltyClient
      stats={result.data}
      cashbackRate={LOYALTY_CASHBACK_RATE}
    />
  )
}
