'use client'

/**
 * Payout details (PR 7): the ONE place a seller saves where they are paid —
 * a crypto destination (coin + network + address) and/or a Payoneer email.
 * Withdrawal requests read from here; any change pauses withdrawals for the
 * freeze window and emails the seller. Two cards on the Payouts tab, each
 * saving itself.
 */

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SettingsCard, Field, accountInputCls, accountBtn } from '@/components/account/AccountSurface'
import { CHAIN_LABELS, COIN_CHAINS, validatePayoutAddress, type PayoutChain } from '@/lib/crypto/address-validation'
import { getMyPayoutDetails, savePayoutDetails, type PayoutDetails } from '@/lib/actions/payout-details'

const fmt = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''

export default function PayoutDetailsSection() {
  const [details, setDetails] = useState<PayoutDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [coin, setCoin] = useState('usdt')
  const [chain, setChain] = useState<string>('tron')
  const [address, setAddress] = useState('')
  const [email, setEmail] = useState('')
  const [savingCrypto, setSavingCrypto] = useState(false)
  const [savingEmail, setSavingEmail] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const r = await getMyPayoutDetails()
      if (cancelled) return
      if (r.success && r.details) {
        setDetails(r.details)
        if (r.details.cryptoCoin) setCoin(r.details.cryptoCoin)
        if (r.details.cryptoChain) setChain(r.details.cryptoChain)
        setAddress(r.details.cryptoAddress ?? '')
        setEmail(r.details.payoneerEmail ?? '')
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const chains = COIN_CHAINS[coin] ?? []
  const effectiveChain = chains.includes(chain as PayoutChain) ? chain : chains[0] ?? ''
  const addressCheck = address.trim() ? validatePayoutAddress(coin, effectiveChain, address.trim()) : null
  const frozen = details?.freezeUntil ? new Date(details.freezeUntil).getTime() > Date.now() : false

  async function saveCrypto() {
    if (!addressCheck?.valid) {
      toast.error(addressCheck?.error || 'Enter a valid wallet address')
      return
    }
    setSavingCrypto(true)
    const r = await savePayoutDetails({ kind: 'crypto', coin, chain: effectiveChain, address: address.trim() })
    setSavingCrypto(false)
    if (!r.success) return void toast.error(r.error || 'Could not save')
    toast.success(r.changed ? 'Payout address saved — withdrawals reopen in 48 hours' : 'Payout address unchanged')
    const fresh = await getMyPayoutDetails()
    if (fresh.success && fresh.details) setDetails(fresh.details)
  }

  async function saveEmail() {
    setSavingEmail(true)
    const r = await savePayoutDetails({ kind: 'payoneer', email: email.trim() })
    setSavingEmail(false)
    if (!r.success) return void toast.error(r.error || 'Could not save')
    toast.success(r.changed ? 'Payoneer email saved — withdrawals reopen in 48 hours' : 'Payoneer email unchanged')
    const fresh = await getMyPayoutDetails()
    if (fresh.success && fresh.details) setDetails(fresh.details)
  }

  if (loading) {
    return (
      <div className="space-y-4" aria-busy>
        {[0, 1].map((i) => (
          <div key={i} className="rounded-lg bg-bg-raised p-5 sm:p-6">
            <div className="skeleton h-4 w-32 rounded" />
            <div className="skeleton mt-2 h-3.5 w-72 max-w-full rounded" />
            <div className="skeleton mt-5 h-11 w-full rounded-md" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {frozen && (
        <p className="flex items-start gap-2.5 rounded-md bg-warning-bg px-4 py-3 text-[13px] leading-relaxed text-warning">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          Payout details changed {fmt(details?.detailsChangedAt)}. Withdrawals reopen {fmt(details?.freezeUntil)}.
        </p>
      )}

      <SettingsCard
        title="Crypto Wallet"
        description="Withdrawals can be paid to a crypto wallet (USDT over TRON, Ethereum or Polygon). For your security, any change pauses withdrawals for 48 hours and we email you."
        footerHint="Only send over the network you pick. A wrong-network payout can’t be recovered."
        footerAction={
          <button type="button" onClick={saveCrypto} disabled={savingCrypto || !addressCheck?.valid} className={accountBtn.primary}>
            {savingCrypto && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
            Save Wallet
          </button>
        }
      >
        <div className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Coin" htmlFor="payout-coin">
              <select id="payout-coin" value={coin} onChange={(e) => setCoin(e.target.value)} className={accountInputCls}>
                {Object.keys(COIN_CHAINS).map((c) => (
                  <option key={c} value={c}>{c.toUpperCase()}</option>
                ))}
              </select>
            </Field>
            <Field label="Network" htmlFor="payout-network">
              <select id="payout-network" value={effectiveChain} onChange={(e) => setChain(e.target.value)} className={accountInputCls}>
                {chains.map((c) => (
                  <option key={c} value={c}>{CHAIN_LABELS[c]}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field
            label="Wallet Address"
            htmlFor="payout-address"
            error={addressCheck && !addressCheck.valid ? addressCheck.error : null}
            hint={addressCheck?.valid ? <span className="text-success">Address looks valid.</span> : null}
          >
            <input
              id="payout-address"
              name="crypto_address"
              type="text"
              translate="no"
              spellCheck={false}
              autoComplete="off"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={effectiveChain === 'tron' ? 'T…' : effectiveChain === 'bitcoin' ? 'bc1… or 1… / 3…' : '0x…'}
              className={cn(
                accountInputCls,
                'font-mono',
                addressCheck && !addressCheck.valid && 'border-[color-mix(in_srgb,var(--color-error)_50%,transparent)] hover:border-[color-mix(in_srgb,var(--color-error)_50%,transparent)]',
              )}
            />
          </Field>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Payoneer"
        description="The email your Payoneer account is registered with. One Payoneer account per seller."
        footerHint="A change pauses withdrawals for 48 hours."
        footerAction={
          <button type="button" onClick={saveEmail} disabled={savingEmail || !email.trim()} className={accountBtn.primary}>
            {savingEmail && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
            Save Email
          </button>
        }
      >
        <Field label="Payoneer Email" htmlFor="payout-payoneer">
          <input
            id="payout-payoneer"
            name="payoneer_email"
            type="email"
            spellCheck={false}
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={accountInputCls}
          />
        </Field>
      </SettingsCard>
    </div>
  )
}
