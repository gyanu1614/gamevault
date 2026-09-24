'use server'

/**
 * Saved payout details (PR 7, Part 3). One row per seller: a crypto
 * destination (coin + chain + address) and/or a Payoneer email. Withdrawal
 * requests read the destination from here — it is never typed per request.
 * Any change stamps details_changed_at, which blocks withdrawals for
 * platform_fee_settings.payout_details_freeze_hours (48 h) and emails the
 * seller (an attacker who changes the address cannot cash out before the
 * owner sees the email).
 *
 * Secrets are stored ENCRYPTED (AES-256-GCM, PAYOUT_ENCRYPTION_KEY) with an
 * HMAC hash for equality; only these server actions decrypt, and only into
 * the owner's own response.
 */

import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { revalidatePath } from 'next/cache'
import { validatePayoutAddress, COIN_CHAINS, type PayoutChain } from '@/lib/crypto/address-validation'
import { encryptPayoutSecret, hashPayoutSecret, revealPayoutSecret } from '@/lib/crypto/payout-encryption'

export interface PayoutDetails {
  cryptoCoin: string | null
  cryptoChain: string | null
  cryptoAddress: string | null
  payoneerEmail: string | null
  detailsChangedAt: string | null
  freezeUntil: string | null
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export async function getMyPayoutDetails(): Promise<{ success: boolean; details?: PayoutDetails; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }
    const service = createServiceRoleClient()
    const [{ data: row }, { data: settings }] = await Promise.all([
      (service as any).from('seller_payout_details').select('*').eq('seller_id', user.id).maybeSingle(),
      (service as any).from('platform_fee_settings').select('payout_details_freeze_hours').eq('id', true).maybeSingle(),
    ])
    const changed = row?.details_changed_at ? new Date(row.details_changed_at) : null
    const freezeHours = Number(settings?.payout_details_freeze_hours ?? 48)
    return {
      success: true,
      details: {
        cryptoCoin: row?.crypto_coin ?? null,
        cryptoChain: row?.crypto_chain ?? null,
        // Decrypted server-side for the OWNER only (this action is session-scoped).
        cryptoAddress: revealPayoutSecret(row?.crypto_address_enc ?? row?.crypto_address_plain),
        payoneerEmail: revealPayoutSecret(row?.payoneer_email_enc ?? row?.payoneer_email_plain),
        detailsChangedAt: changed?.toISOString() ?? null,
        freezeUntil: changed ? new Date(changed.getTime() + freezeHours * 3_600_000).toISOString() : null,
      },
    }
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Failed to load payout details' }
  }
}

export type SavePayoutDetailsInput =
  | { kind: 'crypto'; coin: string; chain: string; address: string }
  | { kind: 'payoneer'; email: string }

export async function savePayoutDetails(input: SavePayoutDetailsInput): Promise<{
  success: boolean
  changed?: boolean
  freezeUntil?: string | null
  error?: string
}> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    let args: Record<string, unknown>
    if (input.kind === 'crypto') {
      const coin = String(input.coin ?? '').trim().toLowerCase()
      const chain = String(input.chain ?? '').trim().toLowerCase()
      const address = String(input.address ?? '').trim()
      if (!(coin in COIN_CHAINS) || !COIN_CHAINS[coin].includes(chain as PayoutChain)) {
        return { success: false, error: 'Pick a supported coin and network.' }
      }
      // Authoritative shape check: crypto sends are irreversible.
      const check = validatePayoutAddress(coin, chain, address)
      if (!check.valid) return { success: false, error: check.error || 'Invalid wallet address.' }
      args = {
        p_seller_id: user.id, p_kind: 'crypto', p_coin: coin, p_chain: chain,
        p_address_enc: encryptPayoutSecret(address), p_address_hash: hashPayoutSecret(address),
        p_email_enc: null, p_email_hash: null,
      }
    } else {
      const email = String(input.email ?? '').trim().toLowerCase()
      if (!EMAIL_RE.test(email) || email.length > 254) return { success: false, error: 'Enter a valid Payoneer email address.' }
      args = {
        p_seller_id: user.id, p_kind: 'payoneer', p_coin: null, p_chain: null, p_address_enc: null, p_address_hash: null,
        p_email_enc: encryptPayoutSecret(email), p_email_hash: hashPayoutSecret(email),
      }
    }

    const service = createServiceRoleClient()
    const { data, error } = await (service.rpc as any)('seller_payout_details_set', args)
    if (error) return { success: false, error: error.message }
    if (!data?.saved) {
      if (data?.reason === 'email_in_use') return { success: false, error: 'That Payoneer email is already linked to another seller account.' }
      return { success: false, error: 'Could not save payout details.' }
    }

    if (data.changed) {
      // Security email — best-effort, never blocks the save.
      await (async () => {
        const { data: profile } = await service.from('profiles').select('email, username, full_name').eq('id', user.id).single() as any
        if (!profile?.email) return
        const { sendPayoutDetailsChangedEmail } = await import('@/lib/email')
        await sendPayoutDetailsChangedEmail({
          to: profile.email,
          name: profile.full_name || profile.username || 'there',
          kind: input.kind,
          summary: input.kind === 'crypto'
            ? `${String(input.coin).toUpperCase()} on ${String(input.chain)} — …${String(input.address).trim().slice(-6)}`
            : `Payoneer — ${String(input.email).trim().toLowerCase()}`,
          freezeUntil: data.freeze_until ?? null,
        })
      })().catch((err) => console.error('[PayoutDetails] change email failed:', err))
    }

    revalidatePath('/account/settings')
    revalidatePath('/account/wallet/withdraw')
    return { success: true, changed: Boolean(data.changed), freezeUntil: data.freeze_until ?? null }
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Failed to save payout details' }
  }
}
