'use client'

/**
 * Payout details: the ONE place a seller saves where they are paid, a crypto wallet
 * (coin + network + address) and/or a Payoneer email. Withdrawal requests read from
 * here. A change pauses withdrawals for the time set in platform_fee_settings and
 * emails the seller, so changing saved details asks first. Two cards on the Payouts
 * tab, each saving itself.
 */

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { CurrencyCircleDollarIcon } from '@phosphor-icons/react/dist/csr/CurrencyCircleDollar'
import { EnvelopeSimpleIcon } from '@phosphor-icons/react/dist/csr/EnvelopeSimple'
import { ShieldWarningIcon } from '@phosphor-icons/react/dist/csr/ShieldWarning'
import { ROW_CHECKED_CLASS, ROW_IDLE_CLASS, rowStyle } from '@/app/checkout/[id]/_surfaces'
import { IconTile, SettingsCard, StatusPill, Field, accountInputCls, accountBtn } from '@/components/account/AccountSurface'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import CoinBadge from '@/components/wallet/CoinBadge'
import { cn } from '@/lib/utils'
import { CHAIN_LABELS, COIN_CHAINS, validatePayoutAddress, type PayoutChain } from '@/lib/crypto/address-validation'
import { getMyPayoutDetails, savePayoutDetails, type PayoutDetails } from '@/lib/actions/payout-details'

const fmt = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''

const COIN_LABELS: Record<string, string> = { usdt: 'USDT', usdc: 'USDC', btc: 'Bitcoin', eth: 'Ethereum' }

/** A choice in the checkout's row style: a trust-blue edge when picked. */
function Choice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      style={rowStyle(selected)}
      className={cn(
        'inline-flex min-h-[44px] items-center gap-2 rounded-md px-3 text-[13px] font-medium text-text-primary transition-[background-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
        selected ? ROW_CHECKED_CLASS : ROW_IDLE_CLASS,
      )}
    >
      {children}
    </button>
  )
}

type PendingSave = { kind: 'crypto' } | { kind: 'payoneer' }

export default function PayoutDetailsSection() {
  const [details, setDetails] = useState<PayoutDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [coin, setCoin] = useState('usdt')
  const [chain, setChain] = useState<string>('tron')
  const [address, setAddress] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState<PendingSave['kind'] | null>(null)
  const [confirm, setConfirm] = useState<PendingSave | null>(null)

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

  const hours = details?.freezeHours ?? 24
  const chains = COIN_CHAINS[coin] ?? []
  const effectiveChain = chains.includes(chain as PayoutChain) ? chain : chains[0] ?? ''
  const trimmedAddress = address.trim()
  const addressCheck = trimmedAddress ? validatePayoutAddress(coin, effectiveChain, trimmedAddress) : null
  const frozen = details?.freezeUntil ? new Date(details.freezeUntil).getTime() > Date.now() : false

  const cryptoSaved = !!details?.cryptoAddress
  const cryptoChanged = trimmedAddress !== (details?.cryptoAddress ?? '') || coin !== (details?.cryptoCoin ?? coin) || effectiveChain !== (details?.cryptoChain ?? effectiveChain)
  const emailSaved = !!details?.payoneerEmail
  const emailChanged = email.trim() !== (details?.payoneerEmail ?? '')

  async function save(kind: PendingSave['kind']) {
    setConfirm(null)
    setSaving(kind)
    const r = await savePayoutDetails(
      kind === 'crypto'
        ? { kind: 'crypto', coin, chain: effectiveChain, address: trimmedAddress }
        : { kind: 'payoneer', email: email.trim() },
    )
    setSaving(null)
    if (!r.success) return void toast.error(r.error || 'Could not save. Please try again.')
    toast.success(r.changed ? `Payout details saved. Withdrawals resume in ${hours} hours.` : 'No changes to save.')
    const fresh = await getMyPayoutDetails()
    if (fresh.success && fresh.details) setDetails(fresh.details)
  }

  /** Replacing saved details pauses withdrawals, so that one asks first. */
  function requestSave(kind: PendingSave['kind']) {
    const replacing = kind === 'crypto' ? cryptoSaved : emailSaved
    if (replacing) setConfirm({ kind })
    else void save(kind)
  }

  if (loading) {
    return (
      <div className="space-y-4" aria-busy>
        {[0, 1].map((i) => (
          <div key={i} className="rounded-lg bg-bg-raised p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="skeleton h-10 w-10 shrink-0 rounded-md" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-4 w-32 rounded" />
                <div className="skeleton h-3.5 w-72 max-w-full rounded" />
              </div>
            </div>
            <div className="skeleton mt-5 h-11 w-full rounded-md" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {frozen && (
        <div className="flex items-center gap-3 rounded-lg bg-warning-bg p-4 text-[13px] leading-relaxed text-text-secondary">
          <IconTile tone="attention"><ShieldWarningIcon size={22} weight="duotone" /></IconTile>
          <p>Payout details changed {fmt(details?.detailsChangedAt)}. Withdrawals resume {fmt(details?.freezeUntil)}.</p>
        </div>
      )}

      <SettingsCard
        title="Crypto Wallet"
        description="Your wallet for crypto withdrawals."
        icon={<CurrencyCircleDollarIcon size={22} weight="duotone" />}
        iconTone="money"
        aside={<StatusPill tone={cryptoSaved ? 'money' : 'neutral'}>{cryptoSaved ? 'Saved' : 'Not Set Up'}</StatusPill>}
        footerHint="Check the network carefully. Funds sent to the wrong network can’t be recovered."
        footerAction={
          <button type="button" onClick={() => requestSave('crypto')} disabled={saving === 'crypto' || !addressCheck?.valid || !cryptoChanged} className={accountBtn.primary}>
            {saving === 'crypto' && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
            Save Wallet
          </button>
        }
      >
        <div className="space-y-5">
          <div>
            <p id="payout-coin-label" className="mb-2 text-[13px] font-medium text-text-secondary">Coin</p>
            <div role="radiogroup" aria-labelledby="payout-coin-label" className="flex flex-wrap gap-2">
              {Object.keys(COIN_CHAINS).map((c) => (
                <Choice key={c} selected={coin === c} onClick={() => setCoin(c)}>
                  <CoinBadge coin={c} methodName={c} size={22} />
                  {COIN_LABELS[c] ?? c.toUpperCase()}
                </Choice>
              ))}
            </div>
          </div>
          {chains.length > 1 && (
            <div>
              <p id="payout-network-label" className="mb-2 text-[13px] font-medium text-text-secondary">Network</p>
              <div role="radiogroup" aria-labelledby="payout-network-label" className="flex flex-wrap gap-2">
                {chains.map((c) => (
                  <Choice key={c} selected={effectiveChain === c} onClick={() => setChain(c)}>{CHAIN_LABELS[c]}</Choice>
                ))}
              </div>
            </div>
          )}
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
              placeholder={effectiveChain === 'tron' ? 'T…' : effectiveChain === 'bitcoin' ? 'bc1…, 1… or 3…' : '0x…'}
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
        description="The email your Payoneer account is registered with."
        icon={<EnvelopeSimpleIcon size={22} weight="duotone" />}
        iconTone="trust"
        aside={<StatusPill tone={emailSaved ? 'money' : 'neutral'}>{emailSaved ? 'Saved' : 'Not Set Up'}</StatusPill>}
        footerHint={`Changing it pauses withdrawals for ${hours} hours.`}
        footerAction={
          <button type="button" onClick={() => requestSave('payoneer')} disabled={saving === 'payoneer' || !email.trim() || !emailChanged} className={accountBtn.primary}>
            {saving === 'payoneer' && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
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
            placeholder="you@example.com…"
            className={accountInputCls}
          />
        </Field>
      </SettingsCard>

      <Dialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent className="max-w-[420px] p-5 sm:p-6">
          <DialogTitle className="pr-8 text-base font-semibold">Change Payout Details?</DialogTitle>
          <DialogDescription>
            For your security, withdrawals are paused for {hours} hours after a change. We’ll notify you by email.
          </DialogDescription>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setConfirm(null)} className={accountBtn.secondary}>Cancel</button>
            <button type="button" onClick={() => confirm && void save(confirm.kind)} className={accountBtn.primary}>Save Changes</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
