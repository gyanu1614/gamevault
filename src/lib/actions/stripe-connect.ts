/**
 * Stripe Connect Server Actions
 *
 * These server actions provide a safe interface for client components
 * to interact with Stripe Connect functionality for seller onboarding
 * and payout management.
 */

'use server'

import { createClient } from '@/lib/supabase/server'
import {
  createConnectAccount,
  getConnectAccountStatus,
  generateOnboardingLink,
  generateLoginLink,
  type ConnectAccountStatus,
} from '@/lib/stripe/connect'

// ─── Response Types ───────────────────────────────────────────────

export interface ConnectOnboardingResult {
  success: boolean
  url: string | null
  accountId?: string
  error?: string
}

export interface ConnectStatusResult {
  success: boolean
  status: ConnectAccountStatus | null
  error?: string
}

export interface ConnectLinkResult {
  success: boolean
  url: string | null
  error?: string
}

// ─── Onboarding Actions ───────────────────────────────────────────

/**
 * initiateConnectOnboarding
 *
 * Starts the Stripe Connect onboarding process for the current user.
 * Creates a new Express account if one doesn't exist, or generates
 * a fresh onboarding link if the account is incomplete.
 *
 * @returns Onboarding URL to redirect the seller to
 */
export async function initiateConnectOnboarding(): Promise<ConnectOnboardingResult> {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return {
        success: false,
        url: null,
        error: 'Not authenticated',
      }
    }

    // Verify user is an approved seller
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_seller_approved, stripe_connect_account_id')
      .eq('id', user.id)
      .single()

    if (!profile?.is_seller_approved) {
      return {
        success: false,
        url: null,
        error: 'You must be an approved seller to connect your account',
      }
    }

    // Create Connect account (or get fresh onboarding link)
    const { accountId, onboardingUrl } = await createConnectAccount(user.id)

    return {
      success: true,
      url: onboardingUrl,
      accountId,
    }
  } catch (error) {
    console.error('[Stripe Connect] Onboarding failed:', error)
    return {
      success: false,
      url: null,
      error: error instanceof Error ? error.message : 'Failed to initiate onboarding',
    }
  }
}

/**
 * refreshAccountLink
 *
 * Generates a fresh onboarding link for an existing Connect account.
 * Used when the previous link expired or when the user returns to
 * complete onboarding.
 *
 * @returns Fresh onboarding URL
 */
export async function refreshAccountLink(): Promise<ConnectLinkResult> {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return {
        success: false,
        url: null,
        error: 'Not authenticated',
      }
    }

    // Get account ID from profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_connect_account_id')
      .eq('id', user.id)
      .single()

    if (!profile?.stripe_connect_account_id) {
      return {
        success: false,
        url: null,
        error: 'No Connect account found. Please start onboarding first.',
      }
    }

    // Generate fresh onboarding link
    const url = await generateOnboardingLink(profile.stripe_connect_account_id)

    return {
      success: true,
      url,
    }
  } catch (error) {
    console.error('[Stripe Connect] Link refresh failed:', error)
    return {
      success: false,
      url: null,
      error: error instanceof Error ? error.message : 'Failed to refresh link',
    }
  }
}

/**
 * getDashboardLink
 *
 * Generates a Stripe Express Dashboard login link for an already-verified
 * seller. This allows them to view their balance, payouts, and account settings
 * directly in Stripe's interface.
 *
 * @returns Dashboard login URL
 */
export async function getDashboardLink(): Promise<ConnectLinkResult> {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return {
        success: false,
        url: null,
        error: 'Not authenticated',
      }
    }

    // Get account ID and verify it's active
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_connect_account_id, stripe_connect_status')
      .eq('id', user.id)
      .single()

    if (!profile?.stripe_connect_account_id) {
      return {
        success: false,
        url: null,
        error: 'No Connect account found',
      }
    }

    if (profile.stripe_connect_status !== 'active') {
      return {
        success: false,
        url: null,
        error: 'Your account must be fully verified to access the dashboard',
      }
    }

    // Generate dashboard login link
    const url = await generateLoginLink(profile.stripe_connect_account_id)

    return {
      success: true,
      url,
    }
  } catch (error) {
    console.error('[Stripe Connect] Dashboard link failed:', error)
    return {
      success: false,
      url: null,
      error: error instanceof Error ? error.message : 'Failed to generate dashboard link',
    }
  }
}

// ─── Status Actions ───────────────────────────────────────────────

/**
 * getConnectAccountDetails
 *
 * Fetches the complete Connect account status for the current user.
 * Syncs with Stripe to get the latest status, then returns balance,
 * onboarding progress, and hold information.
 *
 * @returns Complete Connect account status
 */
export async function getConnectAccountDetails(): Promise<ConnectStatusResult> {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return {
        success: false,
        status: null,
        error: 'Not authenticated',
      }
    }

    // Get full status (syncs with Stripe)
    const status = await getConnectAccountStatus(user.id)

    return {
      success: true,
      status,
    }
  } catch (error) {
    console.error('[Stripe Connect] Status fetch failed:', error)
    return {
      success: false,
      status: null,
      error: error instanceof Error ? error.message : 'Failed to fetch account status',
    }
  }
}

/**
 * canReceivePayouts
 *
 * Quick check to determine if a seller can receive instant payouts.
 * Returns false if:
 * - No Connect account
 * - Account not verified (charges_enabled = false)
 * - In 14-day hold period
 *
 * @returns Boolean indicating payout eligibility
 */
export async function canReceivePayouts(): Promise<{
  ready: boolean
  missing_requirements: string[]
  error?: string
}> {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return {
        ready: false,
        missing_requirements: ['Not authenticated'],
      }
    }

    const status = await getConnectAccountStatus(user.id)

    const requirements: string[] = []

    if (!status.isConnected) {
      requirements.push('Connect your Stripe account')
    }

    if (!status.chargesEnabled) {
      requirements.push('Complete Stripe verification')
    }

    if (status.isInHold) {
      requirements.push('Wait for 14-day hold period to complete')
    }

    return {
      ready: requirements.length === 0,
      missing_requirements: requirements,
    }
  } catch (error) {
    console.error('[Stripe Connect] Payout eligibility check failed:', error)
    return {
      ready: false,
      missing_requirements: ['Error checking requirements'],
      error: error instanceof Error ? error.message : 'Failed to check payout eligibility',
    }
  }
}

/**
 * checkOnboardingStatus
 *
 * Called after user returns from Stripe onboarding flow.
 * Checks if onboarding is complete and updates the UI accordingly.
 *
 * @returns Whether onboarding is complete
 */
export async function checkOnboardingStatus(): Promise<{
  complete: boolean
  status: ConnectAccountStatus | null
  error?: string
}> {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return {
        complete: false,
        status: null,
        error: 'Not authenticated',
      }
    }

    // Get status (syncs with Stripe)
    const status = await getConnectAccountStatus(user.id)

    return {
      complete: status.status === 'active' && status.chargesEnabled && status.payoutsEnabled,
      status,
    }
  } catch (error) {
    console.error('[Stripe Connect] Onboarding status check failed:', error)
    return {
      complete: false,
      status: null,
      error: error instanceof Error ? error.message : 'Failed to check onboarding status',
    }
  }
}
