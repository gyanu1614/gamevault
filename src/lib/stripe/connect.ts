/**
 * P2.1 — Stripe Connect Library
 *
 * Handles seller onboarding and account status ONLY.
 *
 * Architecture:
 * - Express connected accounts (Stripe handles KYC + compliance)
 * - Since the funds-flow cutover (2026-07-15), order completion credits the
 *   seller's internal ledger balance (safedrop_transition) — no Stripe
 *   transfer fires on completion, and cash-out happens exclusively through
 *   the withdrawal_requests flow.
 */

'use server'

import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'

// ─── Local query-result types (avoids Supabase string-select inference issues)
interface SellerProfileBasic {
  email: string | null
  username: string | null
  stripe_connect_account_id: string | null
}
interface SellerProfileConnect {
  stripe_connect_account_id: string | null
  stripe_connect_status: string | null
  stripe_connect_charges_enabled: boolean
  stripe_connect_payouts_enabled: boolean
  stripe_connect_onboarding_url: string | null
  seller_balance: number
  pending_balance: number
  lifetime_earnings: number
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

// ─── Types ────────────────────────────────────────────────────

export interface ConnectAccountStatus {
  isConnected:     boolean
  accountId:       string | null
  status:          'not_connected' | 'pending' | 'restricted' | 'active' | 'disabled'
  chargesEnabled:  boolean
  payoutsEnabled:  boolean
  onboardingUrl:   string | null
  sellerBalance:   number
  pendingBalance:  number
  lifetimeEarnings: number
  isInHold:        boolean
}

// ─── Account Management ───────────────────────────────────────

/**
 * createConnectAccount — creates a Stripe Express account for a seller
 * and returns the onboarding URL.
 */
export async function createConnectAccount(sellerId: string): Promise<{
  accountId: string
  onboardingUrl: string
}> {
  const supabase = await createClient()

  // Get seller profile
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('email, username, stripe_connect_account_id')
    .eq('id', sellerId)
    .single() as unknown as { data: SellerProfileBasic | null; error: Error | null }

  if (error || !profile) throw new Error('Seller profile not found')

  // If already has an account, generate a new onboarding link
  if (profile.stripe_connect_account_id) {
    const link = await stripe.accountLinks.create({
      account: profile.stripe_connect_account_id,
      refresh_url: `${APP_URL}/account/wallet/connect?refresh=1`,
      return_url:  `${APP_URL}/account/wallet/connect?success=1`,
      type: 'account_onboarding',
    })
    return { accountId: profile.stripe_connect_account_id, onboardingUrl: link.url }
  }

  // Create new Express account
  const account = await stripe.accounts.create({
    type: 'express',
    email: profile.email ?? undefined,
    metadata: {
      seller_id: sellerId,
      username:  profile.username ?? '',
    },
    capabilities: {
      transfers: { requested: true },
    },
    settings: {
      payouts: {
        schedule: { interval: 'daily' },
      },
    },
  })

  // Create onboarding link
  const link = await stripe.accountLinks.create({
    account: account.id,
    refresh_url: `${APP_URL}/account/wallet/connect?refresh=1`,
    return_url:  `${APP_URL}/account/wallet/connect?success=1`,
    type: 'account_onboarding',
  })

  // Persist to DB
  const serviceClient = createServiceRoleClient()
  await (serviceClient
    .from('profiles') as any)
    .update({
      stripe_connect_account_id: account.id,
      stripe_connect_status: 'pending',
      stripe_connect_onboarding_url: link.url,
    })
    .eq('id', sellerId)

  return { accountId: account.id, onboardingUrl: link.url }
}

/**
 * getConnectAccountStatus — fetches the full Connect status for a seller.
 * Syncs Stripe's current state to the DB before returning.
 */
export async function getConnectAccountStatus(
  sellerId: string
): Promise<ConnectAccountStatus> {
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select(`
      stripe_connect_account_id,
      stripe_connect_status,
      stripe_connect_charges_enabled,
      stripe_connect_payouts_enabled,
      stripe_connect_onboarding_url,
      seller_balance,
      pending_balance,
      lifetime_earnings
    `)
    .eq('id', sellerId)
    .single() as unknown as { data: SellerProfileConnect | null }

  if (!profile?.stripe_connect_account_id) {
    return {
      isConnected:     false,
      accountId:       null,
      status:          'not_connected',
      chargesEnabled:  false,
      payoutsEnabled:  false,
      onboardingUrl:   null,
      sellerBalance:   0,
      pendingBalance:  0,
      lifetimeEarnings: 0,
      isInHold:        false,
    }
  }

  // Sync with Stripe (live status)
  let stripeStatus: ConnectAccountStatus['status'] = 'pending'
  let chargesEnabled = false
  let payoutsEnabled = false

  try {
    const account = await stripe.accounts.retrieve(profile.stripe_connect_account_id)
    chargesEnabled = account.charges_enabled
    payoutsEnabled = account.payouts_enabled

    if (account.charges_enabled && account.payouts_enabled) {
      stripeStatus = 'active'
    } else if ((account as any).disabled_reason) {
      stripeStatus = 'disabled'
    } else if (account.requirements?.currently_due?.length) {
      stripeStatus = 'restricted'
    }

    // Sync to DB if status changed
    if (stripeStatus !== profile.stripe_connect_status ||
        chargesEnabled !== profile.stripe_connect_charges_enabled) {
      const serviceClient = createServiceRoleClient()
      await (serviceClient.from('profiles') as any)
        .update({
          stripe_connect_status: stripeStatus,
          stripe_connect_charges_enabled: chargesEnabled,
          stripe_connect_payouts_enabled: payoutsEnabled,
          stripe_connect_connected_at: stripeStatus === 'active'
            ? new Date().toISOString()
            : undefined,
        })
        .eq('id', sellerId)
    }
  } catch {
    // Use cached DB status if Stripe API fails
    stripeStatus = (profile.stripe_connect_status as ConnectAccountStatus['status']) ?? 'pending'
    chargesEnabled = profile.stripe_connect_charges_enabled ?? false
    payoutsEnabled = profile.stripe_connect_payouts_enabled ?? false
  }

  // Check 14-day hold
  const serviceClient = createServiceRoleClient()
  const { data: holdCheck } = await (serviceClient as any)
    .rpc('seller_is_in_payout_hold', { p_seller_id: sellerId })
  const isInHold = holdCheck ?? false

  return {
    isConnected:     true,
    accountId:       profile.stripe_connect_account_id,
    status:          stripeStatus,
    chargesEnabled,
    payoutsEnabled,
    onboardingUrl:   profile.stripe_connect_onboarding_url,
    sellerBalance:   Number(profile.seller_balance ?? 0),
    pendingBalance:  Number(profile.pending_balance ?? 0),
    lifetimeEarnings: Number(profile.lifetime_earnings ?? 0),
    isInHold,
  }
}

/**
 * generateOnboardingLink — creates a fresh onboarding/login link for
 * an existing Connect account (links expire after a few minutes).
 */
export async function generateOnboardingLink(accountId: string): Promise<string> {
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${APP_URL}/account/wallet/connect?refresh=1`,
    return_url:  `${APP_URL}/account/wallet/connect?success=1`,
    type: 'account_onboarding',
  })
  return link.url
}

/**
 * generateLoginLink — creates a Stripe Express dashboard login link
 * for an already-verified seller.
 */
export async function generateLoginLink(accountId: string): Promise<string> {
  const link = await stripe.accounts.createLoginLink(accountId)
  return link.url
}

// ─── Payout / Transfer ────────────────────────────────────────
//
// RETIRED (funds-flow cutover, 2026-07-15): transferEscrowToSeller and
// processHeldPayouts are gone. Order completion now credits the seller's
// INTERNAL ledger balance atomically inside safedrop_transition
// (src/lib/escrow/transition.ts) — no Stripe transfer fires on completion.
// Cash leaves the platform only through the withdrawal_requests flow
// (src/lib/actions/withdrawals.ts, fees from lib/fees PAYOUT_FEES).
// Historic 'payouts' rows remain for audit. The onboarding/account helpers
// above are kept for sellers who already connected Stripe accounts.
