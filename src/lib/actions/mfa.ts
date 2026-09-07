'use server'

/**
 * Account two-factor authentication (TOTP), for any signed-in user.
 *
 * Deliberately separate from `admin-mfa.ts`: that module is reached from the
 * admin console and enrols factors labelled "DropMarket Admin TOTP", which is
 * the wrong label in a seller's authenticator app. The underlying Supabase
 * calls are identical and neither module is admin-gated — both act on the
 * caller's own session — but keeping them apart means changing the seller
 * flow can't regress admin sign-in.
 */

import { createClient } from '@/lib/supabase/server'

export interface AccountMfaFactor {
  id: string
  friendlyName: string | null
  status: string
  createdAt: string | null
}

export interface AccountMfaStatus {
  /** True once at least one TOTP factor is verified. */
  enabled: boolean
  /** aal1 = password only, aal2 = second factor satisfied this session. */
  currentLevel: string
  factors: AccountMfaFactor[]
}

export async function getMfaStatus(): Promise<{
  success: boolean
  status?: AccountMfaStatus
  error?: string
}> {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const { data: aal, error: aalError } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (aalError) return { success: false, error: aalError.message }

    const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors()
    if (factorsError) return { success: false, error: factorsError.message }

    // Only verified factors count as "2FA on". An unverified factor is an
    // abandoned enrolment — showing it as enabled would tell the user they
    // are protected when they are not.
    const totp = (factorsData?.totp ?? []) as any[]
    const verified = totp.filter((f) => f.status === 'verified')

    return {
      success: true,
      status: {
        enabled: verified.length > 0,
        currentLevel: aal?.currentLevel ?? 'aal1',
        factors: verified.map((f) => ({
          id: f.id,
          friendlyName: f.friendly_name ?? null,
          status: f.status,
          createdAt: f.created_at ?? null,
        })),
      },
    }
  } catch (error: any) {
    console.error('[mfa] getMfaStatus error:', error)
    return { success: false, error: 'Could not load your security settings.' }
  }
}

/**
 * Begin enrolment. Returns the otpauth:// URI for the QR code plus the
 * secret for manual entry. The factor stays `unverified` until a code is
 * confirmed, so this is safe to call repeatedly.
 */
export async function startMfaEnrollment(): Promise<{
  success: boolean
  factorId?: string
  qrCode?: string
  secret?: string
  error?: string
}> {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    // Clear abandoned enrolments first — Supabase rejects a second factor
    // with the same friendly name, so a cancelled setup would otherwise
    // permanently block re-enrolment.
    const { data: existing } = await supabase.auth.mfa.listFactors()
    for (const factor of ((existing?.all ?? []) as any[])) {
      if (factor.status === 'unverified') {
        await supabase.auth.mfa.unenroll({ factorId: factor.id })
      }
    }

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'DropMarket',
    })
    if (error) return { success: false, error: error.message }

    return {
      success: true,
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
    }
  } catch (error: any) {
    console.error('[mfa] startMfaEnrollment error:', error)
    return { success: false, error: 'Could not start two-factor setup.' }
  }
}

/** Confirm a 6-digit code and activate the factor. */
export async function confirmMfaEnrollment(
  factorId: string,
  code: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const cleaned = (code || '').replace(/\s/g, '')
    if (!/^\d{6}$/.test(cleaned)) {
      return { success: false, error: 'Enter the 6-digit code from your app.' }
    }

    const supabase = await createClient()

    const { data: challenge, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId })
    if (challengeError) return { success: false, error: challengeError.message }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: cleaned,
    })
    if (verifyError) {
      // The only realistic failure is a wrong or expired code; say that
      // rather than leaking the provider's wording.
      return { success: false, error: 'That code didn’t match. Try the current one.' }
    }

    return { success: true }
  } catch (error: any) {
    console.error('[mfa] confirmMfaEnrollment error:', error)
    return { success: false, error: 'Could not verify that code.' }
  }
}

/**
 * Turn 2FA off. Requires a current TOTP code: without it, anyone who walks
 * up to an unlocked, already-signed-in browser could silently strip the
 * second factor off the account.
 */
export async function disableMfa(
  factorId: string,
  code: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const cleaned = (code || '').replace(/\s/g, '')
    if (!/^\d{6}$/.test(cleaned)) {
      return { success: false, error: 'Enter the 6-digit code from your app.' }
    }

    const supabase = await createClient()

    const { data: challenge, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId })
    if (challengeError) return { success: false, error: challengeError.message }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: cleaned,
    })
    if (verifyError) {
      return { success: false, error: 'That code didn’t match. Try the current one.' }
    }

    const { error } = await supabase.auth.mfa.unenroll({ factorId })
    if (error) return { success: false, error: error.message }

    return { success: true }
  } catch (error: any) {
    console.error('[mfa] disableMfa error:', error)
    return { success: false, error: 'Could not turn off two-factor authentication.' }
  }
}
