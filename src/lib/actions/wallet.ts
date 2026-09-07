'use server'

/**
 * Stripe wallet top-up (flag-gated, currently OFF).
 *
 * This module used to be the legacy float-table wallet API. The
 * wallet_balances/wallet_transactions tables were archived by
 * 20260904000000_financial_cleanup_dummy_era.sql; every balance read now
 * goes through src/lib/actions/wallet-ledger.ts (double-entry ledger), and
 * wallet credits/debits are posted via the ledger RPCs in
 * src/lib/wallet/wallet.ts. Do not add float-table reads or writes here.
 */

import { createClient } from '@/lib/supabase/server'
import {
  PURCHASES_ENABLED,
  PURCHASES_DISABLED_MESSAGE,
  WALLET_TOPUP_ENABLED,
  WALLET_TOPUP_DISABLED_MESSAGE,
} from '@/lib/config/purchases'

// ── Create Stripe checkout for top-up ──────────────────────────────────────

export async function createTopUpCheckout(amount: number): Promise<{
  success: boolean
  url?: string
  error?: string
}> {
  try {
    // Wallet top-up has its OWN gate on top of the marketplace-wide one — it
    // stays off when purchases flip on (compliance: prepaying the ledger
    // drifts toward e-money custody; see lib/config/purchases).
    if (!PURCHASES_ENABLED) {
      return { success: false, error: PURCHASES_DISABLED_MESSAGE }
    }
    if (!WALLET_TOPUP_ENABLED) {
      return { success: false, error: WALLET_TOPUP_DISABLED_MESSAGE }
    }

    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Validate amount
    if (amount < 5 || amount > 1000) {
      return { success: false, error: 'Amount must be between $5 and $1000' }
    }

    // Create Stripe checkout session
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Wallet Top-Up',
            description: `Add $${amount.toFixed(2)} to your DropMarket wallet`,
          },
          unit_amount: Math.round(amount * 100), // Convert to cents
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/account/wallet?top_up=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/account/wallet?top_up=cancelled`,
      client_reference_id: user.id,
      metadata: {
        type: 'wallet_top_up',
        user_id: user.id,
        amount: amount.toString(),
      },
    })

    return { success: true, url: session.url }
  } catch (err: any) {
    console.error('[Wallet] Top-up checkout error:', err)
    return { success: false, error: err.message }
  }
}
