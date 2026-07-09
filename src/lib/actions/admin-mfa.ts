'use server'

import { createClient } from '@/lib/supabase/server'

export interface MFAFactor {
  id: string
  factorType: string
  status: string
  friendlyName?: string | null
}

export interface AdminMFAStatus {
  currentLevel: string
  nextLevel: string
  factors: MFAFactor[]
}

/**
 * Get current MFA assurance level and enrolled factors
 */
export async function getAdminMFAStatus(): Promise<{
  success: boolean
  status?: AdminMFAStatus
  error?: string
}> {
  try {
    const supabase = await createClient()

    const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (aalError) return { success: false, error: aalError.message }

    const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors()
    if (factorsError) return { success: false, error: factorsError.message }

    return {
      success: true,
      status: {
        currentLevel: aal.currentLevel ?? 'aal1',
        nextLevel:    aal.nextLevel    ?? 'aal1',
        factors:      (factorsData?.totp ?? []).map((f: any) => ({
          id: f.id,
          factorType: f.factor_type,
          status: f.status,
          friendlyName: f.friendly_name
        })),
      },
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Enroll a new TOTP factor — returns QR code URI and secret.
 * Automatically unenrolls any existing unverified factors with the same name
 * to avoid the "factor already exists" error.
 */
export async function enrollTOTP(): Promise<{
  success: boolean
  factorId?: string
  qrCode?:  string
  secret?:  string
  error?:   string
}> {
  try {
    const supabase = await createClient()

    // Clean up any stale unverified factors before enrolling
    const { data: existing } = await supabase.auth.mfa.listFactors()
    const allFactors = existing?.all ?? []
    const unverified = allFactors.filter((f: any) => f.status === 'unverified')
    for (const f of unverified) {
      await supabase.auth.mfa.unenroll({ factorId: f.id })
    }

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType:   'totp',
      friendlyName: 'DropMarket Admin TOTP',
    })

    if (error) return { success: false, error: error.message }

    return {
      success:  true,
      factorId: data.id,
      qrCode:   data.totp.qr_code,
      secret:   data.totp.secret,
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Challenge + verify a TOTP code — upgrades session to aal2 on success
 */
export async function verifyMFAChallenge(
  factorId: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId })
    if (challengeError) return { success: false, error: challengeError.message }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    })

    if (verifyError) return { success: false, error: verifyError.message }

    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Unenroll (remove) a TOTP factor — use with caution
 */
export async function unenrollFactor(
  factorId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    const { error } = await supabase.auth.mfa.unenroll({ factorId })
    if (error) return { success: false, error: error.message }

    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
