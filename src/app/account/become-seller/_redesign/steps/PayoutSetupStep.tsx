/**
 * Step 4 — Payout Setup ("Forest Ledger" redesign).
 *
 * The seller chooses HOW they get paid (Bank Transfer or Crypto) via two
 * photo-style radio option CARDS — each with an icon, a one-line sub, and the
 * real withdrawal fee pulled from `@/lib/fees` PAYOUT_FEES (no literals). Picking
 * a method reveals only that method's fields. Then a tax-residency country and an
 * optional payout-currency preference. The old tax-form dropdown is intentionally
 * gone (covered by the agreement).
 *
 * Contract: this screen owns a react-hook-form form bound to `step5Schema`, so it
 * emits an exact `Step5FormData`. On a valid advance it calls `onValidSubmit`
 * with { payout, payoutCurrency } — the shapes the adapter's `toStep5(payout,
 * payoutCurrency)` expects. It never touches the server action. `taxForm` is left
 * at its schema default; the adapter forces it to 'none' anyway.
 *
 * The whole surface is deliberately LIGHT (fintech-authentic) and reads its
 * colors from the PALETTE / --sa-* variables the shell exposes.
 */

'use client'

import { useMemo } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Landmark, Bitcoin, Wallet, Globe, CircleDollarSign, ChevronDown } from 'lucide-react'
import { PAYOUT_FEES } from '@/lib/fees'
import { StepHeader } from '../components'
import { PALETTE } from '../theme'
import {
  step5Schema,
  PAYOUT_CURRENCIES,
  type Step5FormData,
  type PayoutCurrency,
} from '../../schemas'
import { COUNTRIES } from '../../data/countries'

// ── Contract ──────────────────────────────────────────────────────────────────

export interface PayoutSetupValue {
  /** Exactly the shape the adapter's toStep5(payout, …) reads. */
  payout: Step5FormData
  /** Optional preferred payout currency, or null when "no preference". */
  payoutCurrency: PayoutCurrency | null
}

interface PayoutSetupStepProps {
  /** Restores prior answers when the seller steps back into this screen. */
  defaultPayout?: Partial<Step5FormData>
  defaultPayoutCurrency?: PayoutCurrency | null
  /** Called with the validated slice when the seller advances. */
  onValidSubmit: (value: PayoutSetupValue) => void
  /** Go to the previous step (no validation). */
  onBack?: () => void
}

// ── Fee formatting (from lib/fees — never inline the numbers) ─────────────────

/** "1.5% + $2" style label for a rail's withdrawal fee. */
function formatPayoutFee(rail: keyof typeof PAYOUT_FEES): string {
  const { pct, fixed } = PAYOUT_FEES[rail]
  return `${pct}% + $${fixed}`
}

const METHOD_OPTIONS = [
  {
    value: 'bank_transfer' as const,
    rail: 'fiat' as const,
    label: 'Bank Transfer',
    sub: 'Paid to your bank account in 1–3 business days.',
    icon: Landmark,
  },
  {
    value: 'crypto' as const,
    rail: 'crypto' as const,
    label: 'Crypto',
    sub: 'Paid to your wallet, usually within the hour.',
    icon: Bitcoin,
  },
]

const CRYPTO_COINS: { value: NonNullable<Step5FormData['cryptoType']>; label: string }[] = [
  { value: 'BTC', label: 'Bitcoin (BTC)' },
  { value: 'ETH', label: 'Ethereum (ETH)' },
  { value: 'USDT', label: 'Tether (USDT)' },
]

const CURRENCY_LABELS: Record<PayoutCurrency, string> = {
  USD: 'US Dollar (USD)',
  EUR: 'Euro (EUR)',
  GBP: 'British Pound (GBP)',
  USDT: 'Tether (USDT)',
}

// ── Shared field primitives (light, soft borders, green focus) ────────────────

function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-sm font-medium"
      style={{ color: PALETTE.ink }}
    >
      {children}
    </label>
  )
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p className="mt-1.5 text-xs" style={{ color: '#B42318' }}>
      {message}
    </p>
  )
}

const inputBase =
  'w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-[color:var(--sa-ink-2)] focus:border-[color:var(--sa-forest-2)] focus:ring-2 focus:ring-[color:var(--sa-forest-2)]/15'

// ── Component ─────────────────────────────────────────────────────────────────

export default function PayoutSetupStep({
  defaultPayout,
  defaultPayoutCurrency = null,
  onValidSubmit,
  onBack,
}: PayoutSetupStepProps) {
  const {
    control,
    register,
    handleSubmit,
    watch,
    getValues,
    formState: { errors },
  } = useForm<Step5FormData>({
    resolver: zodResolver(step5Schema),
    mode: 'onBlur',
    defaultValues: {
      payoutMethod: defaultPayout?.payoutMethod,
      accountHolderName: defaultPayout?.accountHolderName ?? '',
      bankName: defaultPayout?.bankName ?? '',
      accountNumber: defaultPayout?.accountNumber ?? '',
      iban: defaultPayout?.iban ?? '',
      routingCode: defaultPayout?.routingCode ?? '',
      swiftCode: defaultPayout?.swiftCode ?? '',
      cryptoType: defaultPayout?.cryptoType,
      cryptoWalletAddress: defaultPayout?.cryptoWalletAddress ?? '',
      taxResidencyCountry: defaultPayout?.taxResidencyCountry ?? '',
      taxForm: 'none',
    },
  })

  const method = watch('payoutMethod')
  const countryNames = useMemo(() => COUNTRIES.map((c) => c.name), [])

  const submit = handleSubmit((data) => {
    // Currency preference lives OUTSIDE step5Schema, so zodResolver strips it
    // from the parsed `data`. Read it from RHF's own value store instead, then
    // hand both slices to the orchestrator in the exact shape the adapter reads.
    const raw = getValues('payoutCurrency' as keyof Step5FormData) as string | undefined
    const payoutCurrency = (PAYOUT_CURRENCIES as readonly string[]).includes(raw ?? '')
      ? (raw as PayoutCurrency)
      : null
    // `data` is the zod-parsed Step5FormData (currency already absent).
    onValidSubmit({ payout: data, payoutCurrency })
  })

  return (
    <div>
      <StepHeader
        heading="Payout Setup"
        explainer="Choose how you'd like to get paid — your details are encrypted and never shared."
        icon={Wallet}
      />

      <form onSubmit={submit} noValidate className="space-y-8">
        {/* ── Method cards ── */}
        <fieldset>
          <legend className="sr-only">Payout method</legend>
          <Controller
            control={control}
            name="payoutMethod"
            render={({ field }) => (
              <div className="grid gap-3 sm:grid-cols-2">
                {METHOD_OPTIONS.map((opt) => {
                  const selected = field.value === opt.value
                  const Icon = opt.icon
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => field.onChange(opt.value)}
                      aria-pressed={selected}
                      className="group relative flex flex-col rounded-2xl border p-4 text-left transition-all"
                      style={{
                        borderColor: selected ? PALETTE.forest : PALETTE.line,
                        backgroundColor: selected ? 'rgba(20,67,42,0.04)' : PALETTE.paper,
                        boxShadow: selected
                          ? `0 0 0 1px ${PALETTE.forest}`
                          : '0 1px 2px rgba(16,24,40,0.04)',
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                          style={{
                            backgroundColor: selected ? PALETTE.forest : 'rgba(20,67,42,0.06)',
                            color: selected ? PALETTE.lime : PALETTE.forest,
                          }}
                        >
                          <Icon className="h-5 w-5" />
                        </span>
                        {/* Active dot — lime is reserved for exactly this kind of accent. */}
                        <span
                          className="mt-1 flex h-4 w-4 items-center justify-center rounded-full border"
                          style={{
                            borderColor: selected ? PALETTE.forest : PALETTE.line,
                            backgroundColor: selected ? PALETTE.forest : 'transparent',
                          }}
                        >
                          {selected && (
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: PALETTE.lime }}
                            />
                          )}
                        </span>
                      </div>

                      <span
                        className="mt-3 text-sm font-semibold"
                        style={{ color: PALETTE.ink }}
                      >
                        {opt.label}
                      </span>
                      <span className="mt-0.5 text-xs leading-relaxed" style={{ color: PALETTE.ink2 }}>
                        {opt.sub}
                      </span>

                      <span
                        className="mt-3 inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                        style={{
                          backgroundColor: 'rgba(20,67,42,0.06)',
                          color: PALETTE.forest,
                        }}
                      >
                        Withdrawal fee · {formatPayoutFee(opt.rail)}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          />
          <FieldError message={errors.payoutMethod?.message} />
        </fieldset>

        {/* ── Bank transfer fields ── */}
        {method === 'bank_transfer' && (
          <div className="space-y-4">
            <div>
              <FieldLabel htmlFor="accountHolderName">Account Holder Name</FieldLabel>
              <input
                id="accountHolderName"
                type="text"
                autoComplete="name"
                placeholder="As it appears on your bank account"
                className={inputBase}
                style={{ borderColor: PALETTE.line, color: PALETTE.ink }}
                {...register('accountHolderName')}
              />
              <FieldError message={errors.accountHolderName?.message} />
            </div>

            <div>
              <FieldLabel htmlFor="bankName">Bank Name</FieldLabel>
              <input
                id="bankName"
                type="text"
                placeholder="e.g. Chase, Barclays"
                className={inputBase}
                style={{ borderColor: PALETTE.line, color: PALETTE.ink }}
                {...register('bankName')}
              />
              <FieldError message={errors.bankName?.message} />
            </div>

            <div>
              <FieldLabel htmlFor="iban">IBAN or Account Number</FieldLabel>
              <input
                id="iban"
                type="text"
                placeholder="IBAN preferred where available"
                className={inputBase}
                style={{ borderColor: PALETTE.line, color: PALETTE.ink }}
                {...register('iban')}
              />
              <p className="mt-1.5 text-xs" style={{ color: PALETTE.ink2 }}>
                No IBAN? Enter your local account number below.
              </p>
              <FieldError message={errors.iban?.message} />
            </div>

            <div>
              <FieldLabel htmlFor="accountNumber">Account Number (if no IBAN)</FieldLabel>
              <input
                id="accountNumber"
                type="text"
                placeholder="Local account number"
                className={inputBase}
                style={{ borderColor: PALETTE.line, color: PALETTE.ink }}
                {...register('accountNumber')}
              />
              <FieldError message={errors.accountNumber?.message} />
            </div>
          </div>
        )}

        {/* ── Crypto fields ── */}
        {method === 'crypto' && (
          <div className="space-y-4">
            <div>
              <FieldLabel>Coin</FieldLabel>
              <Controller
                control={control}
                name="cryptoType"
                render={({ field }) => (
                  <div className="grid grid-cols-3 gap-2.5">
                    {CRYPTO_COINS.map((coin) => {
                      const selected = field.value === coin.value
                      return (
                        <button
                          key={coin.value}
                          type="button"
                          onClick={() => field.onChange(coin.value)}
                          aria-pressed={selected}
                          className="rounded-xl border px-3 py-2.5 text-sm font-medium transition-all"
                          style={{
                            borderColor: selected ? PALETTE.forest : PALETTE.line,
                            backgroundColor: selected ? 'rgba(20,67,42,0.04)' : PALETTE.paper,
                            color: selected ? PALETTE.forest : PALETTE.ink,
                            boxShadow: selected ? `0 0 0 1px ${PALETTE.forest}` : 'none',
                          }}
                        >
                          {coin.value}
                        </button>
                      )
                    })}
                  </div>
                )}
              />
              <FieldError message={errors.cryptoType?.message} />
            </div>

            <div>
              <FieldLabel htmlFor="cryptoWalletAddress">Wallet Address</FieldLabel>
              <input
                id="cryptoWalletAddress"
                type="text"
                spellCheck={false}
                placeholder="Paste your receiving wallet address"
                className={`${inputBase} font-mono`}
                style={{ borderColor: PALETTE.line, color: PALETTE.ink }}
                {...register('cryptoWalletAddress')}
              />
              <p className="mt-1.5 text-xs" style={{ color: PALETTE.ink2 }}>
                Double-check this — crypto sent to a wrong address can&apos;t be recovered.
              </p>
              <FieldError message={errors.cryptoWalletAddress?.message} />
            </div>
          </div>
        )}

        {/* ── Tax residency + currency preference ── */}
        <div className="space-y-4 border-t pt-8" style={{ borderColor: PALETTE.line }}>
          <div>
            <FieldLabel htmlFor="taxResidencyCountry">
              <span className="inline-flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5" style={{ color: PALETTE.forest2 }} />
                Tax Residency Country
              </span>
            </FieldLabel>
            <div className="relative">
              <select
                id="taxResidencyCountry"
                className={`${inputBase} appearance-none pr-9`}
                style={{ borderColor: PALETTE.line, color: PALETTE.ink }}
                {...register('taxResidencyCountry')}
              >
                <option value="">Select your country of tax residency</option>
                {countryNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2"
                style={{ color: PALETTE.ink2 }}
              />
            </div>
            <FieldError message={errors.taxResidencyCountry?.message} />
          </div>

          <div>
            <FieldLabel htmlFor="payoutCurrency">
              <span className="inline-flex items-center gap-1.5">
                <CircleDollarSign className="h-3.5 w-3.5" style={{ color: PALETTE.forest2 }} />
                Payout Currency Preference
                <span className="font-normal" style={{ color: PALETTE.ink2 }}>
                  (optional)
                </span>
              </span>
            </FieldLabel>
            <div className="relative">
              <select
                id="payoutCurrency"
                className={`${inputBase} appearance-none pr-9`}
                style={{ borderColor: PALETTE.line, color: PALETTE.ink }}
                {...register('payoutCurrency' as keyof Step5FormData)}
              >
                <option value="">No preference</option>
                {PAYOUT_CURRENCIES.map((cur) => (
                  <option key={cur} value={cur}>
                    {CURRENCY_LABELS[cur]}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2"
                style={{ color: PALETTE.ink2 }}
              />
            </div>
          </div>
        </div>

        {/* ── Nav ── */}
        <div className="flex items-center justify-between gap-3 pt-2">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="rounded-xl border px-5 py-2.5 text-sm font-medium transition-colors"
              style={{ borderColor: PALETTE.line, color: PALETTE.forest }}
            >
              Back
            </button>
          ) : (
            <span />
          )}
          <button
            type="submit"
            className="group rounded-xl px-6 py-2.5 text-sm font-semibold text-white transition-all"
            style={{ backgroundColor: PALETTE.forest }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = `0 0 0 2px ${PALETTE.lime}`
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            Continue
          </button>
        </div>
      </form>
    </div>
  )
}
