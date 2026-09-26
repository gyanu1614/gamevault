'use client'

/**
 * Payout details (PR 7): the ONE place a seller saves where they are paid —
 * a crypto destination (coin + network + address) and/or a Payoneer email.
 * Withdrawal requests read from here; any change pauses withdrawals for the
 * freeze window and emails the seller. Same tokens as the rest of settings.
 */

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Mail, ShieldAlert, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'
import { CHAIN_LABELS, COIN_CHAINS, validatePayoutAddress, type PayoutChain } from '@/lib/crypto/address-validation'
import { getMyPayoutDetails, savePayoutDetails, type PayoutDetails } from '@/lib/actions/payout-details'

const inputCls =
  'w-full rounded-lg border border-border-subtle bg-bg-raised px-4 py-2.5 text-base sm:text-sm text-text-primary placeholder:text-text-disabled focus:border-lime focus:outline-none focus:ring-2 focus:ring-lime-tint-bg transition-all'
const btnCls =
  'inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg bg-lime px-4 py-2 text-sm font-semibold text-text-inverse transition-colors hover:bg-lime-hover disabled:cursor-not-allowed disabled:opacity-50'

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
      <div className="flex items-center gap-2 py-4 text-sm text-text-secondary">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading payout details…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <p className="text-[13px] leading-relaxed text-text-secondary">
        Withdrawals are paid to the details saved here — a crypto wallet (USDT over TRON, Ethereum or Polygon) or a
        Payoneer account. For your security, any change pauses withdrawals for 48 hours and we email you.
      </p>
      {frozen && (
        <p className="flex items-start gap-2 rounded-lg border border-warning/25 bg-warning-bg px-3 py-2.5 text-[12px] leading-relaxed text-text-secondary">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
          Payout details changed {fmt(details?.detailsChangedAt)}. Withdrawals reopen {fmt(details?.freezeUntil)}.
        </p>
      )}

      {/* Crypto */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-lime-text" />
          <h3 className="text-sm font-semibold text-text-primary">Crypto Wallet</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-text-secondary">Coin</Label>
            <select value={coin} onChange={(e) => setCoin(e.target.value)} className={inputCls}>
              {Object.keys(COIN_CHAINS).map((c) => (
                <option key={c} value={c}>{c.toUpperCase()}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-text-secondary">Network</Label>
            <select value={effectiveChain} onChange={(e) => setChain(e.target.value)} className={inputCls}>
              {chains.map((c) => (
                <option key={c} value={c}>{CHAIN_LABELS[c]}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium text-text-secondary">Wallet Address</Label>
          <input
            type="text"
            spellCheck={false}
            autoComplete="off"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={effectiveChain === 'tron' ? 'T…' : effectiveChain === 'bitcoin' ? 'bc1… or 1… / 3…' : '0x…'}
            className={cn(inputCls, 'font-mono', addressCheck && !addressCheck.valid && 'border-error/50 focus:border-error')}
          />
          {addressCheck && !addressCheck.valid && <p className="text-xs text-error">{addressCheck.error}</p>}
          {addressCheck?.valid && <p className="text-xs text-lime-text">Address looks valid.</p>}
          <p className="text-xs text-text-tertiary">Only send over the network you pick — a wrong-network payout cannot be recovered.</p>
        </div>
        <button type="button" onClick={saveCrypto} disabled={savingCrypto || !addressCheck?.valid} className={btnCls}>
          {savingCrypto && <Loader2 className="h-4 w-4 animate-spin" />}
          Save Wallet Address
        </button>
      </div>

      {/* Payoneer */}
      <div className="space-y-3 border-t border-border-subtle pt-5">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-lime-text" />
          <h3 className="text-sm font-semibold text-text-primary">Payoneer</h3>
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium text-text-secondary">Payoneer Email</Label>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={inputCls}
          />
          <p className="text-xs text-text-tertiary">The email your Payoneer account is registered with. One Payoneer account per seller.</p>
        </div>
        <button type="button" onClick={saveEmail} disabled={savingEmail || !email.trim()} className={btnCls}>
          {savingEmail && <Loader2 className="h-4 w-4 animate-spin" />}
          Save Payoneer Email
        </button>
      </div>
    </div>
  )
}
