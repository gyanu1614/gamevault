/**
 * P2.1 — Stripe Connect Library
 *
 * Handles seller onboarding, account status, and payout transfers.
 *
 * Architecture:
 * - Express connected accounts (Stripe handles KYC + compliance)
 * - Platform collects platform_fee at checkout via transfer_data
 * - On escrow release: Stripe Transfer from platform → connected account
 * - 14-day payout hold for new sellers (< 3 orders or < 14 days)
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
interface OrderWithSeller {
  id: string
  seller_payout: number
  seller_id: string
  seller: {
    stripe_connect_account_id: string | null
    stripe_connect_status: string | null
    stripe_connect_charges_enabled: boolean
  } | {
    stripe_connect_account_id: string | null
    stripe_connect_status: string | null
    stripe_connect_charges_enabled: boolean
  }[]
}
interface HeldPayout {
  id: string
  seller_id: string
  amount: number
  order_id: string | null
  seller: {
    stripe_connect_account_id: string | null
    stripe_connect_charges_enabled: boolean
  } | {
    stripe_connect_account_id: string | null
    stripe_connect_charges_enabled: boolean
  }[]
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
})

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

export interface PayoutResult {
  success:    boolean
  transferId: string | null
  error:      string | null
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

/**
 * transferEscrowToSeller — called when an order is completed and escrow
 * should be released. Transfers seller_payout from platform to their
 * Connect account.
 *
 * Respects 14-day hold: creates the payout record but marks it as held.
 * A separate cron processes held payouts after the hold expires.
 */
export async function transferEscrowToSeller(orderId: string): Promise<PayoutResult> {
  const serviceClient = createServiceRoleClient()

  // Get order + seller details
  const { data: order, error: orderError } = await (serviceClient as any)
    .from('orders')
    .select(`
      id, seller_payout, seller_id,
      seller:profiles!orders_seller_id_fkey(
        stripe_connect_account_id,
        stripe_connect_status,
        stripe_connect_charges_enabled
      )
    `)
    .eq('id', orderId)
    .single() as { data: OrderWithSeller | null; error: Error | null }

  if (orderError || !order) {
    return { success: false, transferId: null, error: 'Order not found' }
  }

  const seller = Array.isArray(order.seller) ? order.seller[0] : order.seller

  // Validate Connect account is ready
  if (!seller?.stripe_connect_account_id) {
    // Seller hasn't connected — increment balance manually, no transfer yet
    await (serviceClient as any).rpc('release_escrow_to_seller_balance', {
      p_order_id:  orderId,
      p_seller_id: order.seller_id,
      p_amount:    order.seller_payout,
    })
    return { success: true, transferId: null, error: null }
  }

  if (!seller.stripe_connect_charges_enabled) {
    // Account not yet verified — hold the balance
    await (serviceClient as any).rpc('release_escrow_to_seller_balance', {
      p_order_id:  orderId,
      p_seller_id: order.seller_id,
      p_amount:    order.seller_payout,
    })
    return { success: true, transferId: null, error: null }
  }

  // Check 14-day hold
  const { data: isInHold } = await (serviceClient as any)
    .rpc('seller_is_in_payout_hold', { p_seller_id: order.seller_id })

  const holdUntil = isInHold
    ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
    : null

  if (isInHold) {
    // Don't transfer yet — record payout as held
    await (serviceClient.from('payouts') as any).insert({
      seller_id:  order.seller_id,
      amount:     order.seller_payout,
      status:     'pending',
      order_id:   orderId,
      is_held:    true,
      hold_until: holdUntil,
    })

    await (serviceClient as any).rpc('release_escrow_to_seller_balance', {
      p_order_id:  orderId,
      p_seller_id: order.seller_id,
      p_amount:    order.seller_payout,
    })

    return { success: true, transferId: null, error: null }
  }

  // Execute Stripe Transfer
  try {
    const amountCents = Math.round(order.seller_payout * 100)

    const transfer = await stripe.transfers.create({
      amount:            amountCents,
      currency:          'usd',
      destination:       seller.stripe_connect_account_id,
      transfer_group:    `order_${orderId}`,
      metadata: {
        order_id:  orderId,
        seller_id: order.seller_id,
      },
    })

    // Record payout
    await (serviceClient.from('payouts') as any).insert({
      seller_id:          order.seller_id,
      stripe_transfer_id: transfer.id,
      amount:             order.seller_payout,
      status:             'processing',
      order_id:           orderId,
      is_held:            false,
    })

    // Update seller balance
    await (serviceClient as any).rpc('release_escrow_to_seller_balance', {
      p_order_id:  orderId,
      p_seller_id: order.seller_id,
      p_amount:    order.seller_payout,
    })

    return { success: true, transferId: transfer.id, error: null }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Transfer failed'
    console.error('[Stripe Connect] Transfer failed:', message)
    return { success: false, transferId: null, error: message }
  }
}

/**
 * processHeldPayouts — processes payouts where the hold period has expired.
 * Called by a daily cron job.
 */
export async function processHeldPayouts(): Promise<{ processed: number; failed: number }> {
  const serviceClient = createServiceRoleClient()
  let processed = 0
  let failed = 0

  // Find payouts where hold has expired
  const { data: heldPayouts } = await (serviceClient as any)
    .from('payouts')
    .select(`
      id, seller_id, amount, order_id,
      seller:profiles!payouts_seller_id_fkey(
        stripe_connect_account_id,
        stripe_connect_charges_enabled
      )
    `)
    .eq('is_held', true)
    .eq('status', 'pending')
    .lt('hold_until', new Date().toISOString()) as { data: HeldPayout[] | null }

  if (!heldPayouts?.length) return { processed, failed }

  for (const payout of heldPayouts) {
    const seller = Array.isArray(payout.seller) ? payout.seller[0] : payout.seller

    if (!seller?.stripe_connect_account_id || !seller.stripe_connect_charges_enabled) {
      continue
    }

    try {
      const amountCents = Math.round(payout.amount * 100)

      const transfer = await stripe.transfers.create({
        amount:         amountCents,
        currency:       'usd',
        destination:    seller.stripe_connect_account_id,
        transfer_group: payout.order_id ? `order_${payout.order_id}` : undefined,
        metadata: {
          payout_id: payout.id,
          seller_id: payout.seller_id,
        },
      })

      await (serviceClient.from('payouts') as any)
        .update({
          stripe_transfer_id: transfer.id,
          status:    'processing',
          is_held:   false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', payout.id)

      processed++
    } catch {
      failed++
    }
  }

  return { processed, failed }
}
