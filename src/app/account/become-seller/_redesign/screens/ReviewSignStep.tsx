/**
 * ReviewSignStep — Step 5 of the "Forest Ledger" seller-application redesign.
 *
 * A single light-world screen that:
 *   1. Shows a human-readable SUMMARY of everything the seller entered
 *      (games + categories, name, payout) built from the wizard state.
 *   2. Requires a short SELLING EXPERIENCE note (a few lines minimum).
 *   3. Collects CONSOLIDATED CONSENT — one required checkbox covering the Terms
 *      of Service, Privacy Policy & Fee Schedule (each an inline link), validated
 *      by zod .literal(true) — plus the Seller Agency Agreement e-signature via
 *      the env-gated <SignAgreementModal> (DocuSeal embed, or typed-name accept).
 *   4. Offers an OPTIONAL, separate, unchecked-by-default marketing checkbox.
 *   5. Submits → the parent orchestrator drives the restyled SubmissionLoader
 *      and the existing submitSellerApplication via the phase-1 adapter.
 *
 * This screen owns ONLY its own react-hook-form slice (reviewSignSchema). It does
 * NOT mutate other steps' state and it does NOT call the server action — it hands
 * the validated ReviewSignFormData up via onSubmit. All colours come from PALETTE
 * (the application deliberately stays light even under a dark OS theme).
 */

'use client'

import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { parsePhoneNumberFromString } from 'libphonenumber-js'
import {
  ClipboardCheck,
  Check,
  Gamepad2,
  UserRound,
  Wallet,
  Store,
  ChevronLeft,
  Loader2,
  PenLine,
  ShieldCheck,
  Pencil,
} from 'lucide-react'

import { StepHeader } from '../components'
import { PALETTE } from '../theme'
import SignAgreementModal from './SignAgreementModal'
import { reviewSignSchema, type ReviewSignFormData } from '../../schemas'
import type { RedesignedSellerState } from '../adapter'
import { SECTION_LABELS, type SellerCategorySection } from '../game-categories-shared'
import type { WizardGame } from '../../types'
import { OTHER_COUNTRY } from '../../data/countries'
import {
  VOLUME_LABELS,
  PAYOUT_METHOD_LABELS,
  SELLER_TYPE_LABELS,
  CRYPTO_TYPE_LABELS,
  label,
} from '@/lib/seller-application/labels'
import { PAYOUT_FEES, PAYOUT_MIN_USD } from '@/lib/fees'

interface ReviewSignStepProps {
  /** The full wizard state, used to render the read-only summary. */
  state: RedesignedSellerState
  /** Games catalog (id → name/slug) for resolving selected-game labels. */
  games: WizardGame[]
  /** Any partial review data captured on a previous visit to this step. */
  initialData?: Partial<ReviewSignFormData>
  /** Jump back to a given step to edit it (from the summary "Edit" affordances). */
  goToStep?: (step: number) => void
  /** Go to the previous step. */
  onBack?: () => void
  /** Validated review slice → parent adapts + submits. */
  onSubmit: (data: ReviewSignFormData) => void
  /** True while the parent is running the server submit. */
  isSubmitting?: boolean
}

/** One label/value row in a summary card. */
function SummaryRow({ label: rowLabel, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-sm">
      <span className="shrink-0" style={{ color: PALETTE.ink2 }}>
        {rowLabel}
      </span>
      <span className="text-right" style={{ color: PALETTE.ink }}>
        {value}
      </span>
    </div>
  )
}

/** A titled summary card with an optional Edit shortcut back to its step. */
function SummaryCard({
  title,
  icon: Icon,
  step,
  goToStep,
  children,
}: {
  title: string
  icon: typeof Gamepad2
  step: number
  goToStep?: (step: number) => void
  children: React.ReactNode
}) {
  return (
    <div
      className="rounded-xl p-4"
      style={{ backgroundColor: PALETTE.paper, border: `1px solid ${PALETTE.line}` }}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" style={{ color: PALETTE.forest2 }} />
          <h4 className="text-sm font-semibold" style={{ color: PALETTE.forest }}>
            {title}
          </h4>
        </div>
        {goToStep && (
          <button
            type="button"
            onClick={() => goToStep(step)}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors"
            style={{ color: PALETTE.ink2 }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(20,67,42,0.06)'
              e.currentTarget.style.color = PALETTE.forest
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.color = PALETTE.ink2
            }}
          >
            <Pencil className="h-3 w-3" />
            Edit
          </button>
        )}
      </div>
      <div
        style={{ borderTop: `1px solid ${PALETTE.line}` }}
        className="mt-1 divide-y divide-[#E4E5DE]"
      >
        {children}
      </div>
    </div>
  )
}

export default function ReviewSignStep({
  state,
  games,
  initialData,
  goToStep,
  onBack,
  onSubmit,
  isSubmitting = false,
}: ReviewSignStepProps) {
  const [signOpen, setSignOpen] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ReviewSignFormData>({
    resolver: zodResolver(reviewSignSchema),
    defaultValues: {
      sellingExperience: '',
      consolidatedConsent: undefined as unknown as true,
      signatureName: '',
      signedAt: '',
      marketingConsent: false,
      ...initialData,
    },
  })

  const step1 = state.step1
  const step2 = state.step2
  const payout = state.payout

  const consolidatedConsent = watch('consolidatedConsent')
  const marketingConsent = watch('marketingConsent')
  const signatureName = watch('signatureName')
  const signedAt = watch('signedAt')
  const isSigned = !!signatureName && !!signedAt

  // ── Summary derivations ─────────────────────────────────────────────────────

  /** Resolve selected games → { name, sections[] } for the summary. */
  const gameSummaries = useMemo(() => {
    const perGame = new Map<string, SellerCategorySection[]>()
    for (const gc of step1?.gamesCategories ?? []) {
      perGame.set(gc.gameId, gc.categorySlugs as SellerCategorySection[])
    }
    return (step1?.primaryGames ?? []).map((id) => {
      const game = games.find((g) => g.id === id)
      const sections = perGame.get(id) ?? []
      return {
        name: game?.name ?? id,
        sections: sections
          .map((s) => SECTION_LABELS[s] ?? s)
          .filter(Boolean),
      }
    })
  }, [step1?.primaryGames, step1?.gamesCategories, games])

  const reviewCountry =
    step2?.country === OTHER_COUNTRY ? step2?.countryOther || 'Other' : step2?.country
  const reviewPhone = step2?.phoneNumber
    ? parsePhoneNumberFromString(step2.phoneNumber)?.formatInternational() ?? step2.phoneNumber
    : undefined

  const payoutRail = payout?.payoutMethod === 'crypto' ? PAYOUT_FEES.crypto : PAYOUT_FEES.fiat

  // ── Submit ──────────────────────────────────────────────────────────────────

  const submit = (data: ReviewSignFormData) => onSubmit(data)

  return (
    <div>
      <StepHeader
        heading="Review & Sign"
        explainer="One last look — confirm your details, agree to the terms, and sign to enter review."
        icon={ClipboardCheck}
      />

      <form onSubmit={handleSubmit(submit)} className="space-y-6">
        {/* ── Summary ───────────────────────────────────────────────────────── */}
        <section className="space-y-3">
          <SummaryCard title="Games & Categories" icon={Gamepad2} step={1} goToStep={goToStep}>
            <SummaryRow label="Seller Type" value={label(SELLER_TYPE_LABELS, step1?.sellerType)} />
            <SummaryRow label="Monthly Volume" value={label(VOLUME_LABELS, step1?.expectedVolume)} />
            {gameSummaries.length > 0 ? (
              <div className="py-1.5 text-sm">
                <span className="mb-1.5 block" style={{ color: PALETTE.ink2 }}>
                  Games
                </span>
                <div className="space-y-2">
                  {gameSummaries.map((g, i) => (
                    <div key={`${g.name}-${i}`} className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-medium" style={{ color: PALETTE.ink }}>
                        {g.name}
                      </span>
                      {g.sections.map((s) => (
                        <span
                          key={s}
                          className="rounded-full px-2 py-0.5 text-xs font-medium"
                          style={{
                            backgroundColor: 'rgba(20,67,42,0.07)',
                            color: PALETTE.forest2,
                          }}
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <SummaryRow label="Games" value="None selected" />
            )}
            {step1?.otherGames?.trim() && (
              <SummaryRow label="Other Games" value={step1.otherGames.trim()} />
            )}
          </SummaryCard>

          <SummaryCard title="Personal Info" icon={UserRound} step={2} goToStep={goToStep}>
            <SummaryRow label="Legal Name" value={step2?.fullLegalName} />
            <SummaryRow label="Display Name" value={step2?.displayName} />
            <SummaryRow
              label="Location"
              value={[step2?.city, step2?.stateProvince, reviewCountry].filter(Boolean).join(', ')}
            />
            <SummaryRow label="Phone" value={reviewPhone} />
            {step2?.alternateEmail && (
              <SummaryRow label="Alternate Email" value={step2.alternateEmail} />
            )}
          </SummaryCard>

          <SummaryCard title="Storefront" icon={Store} step={2} goToStep={goToStep}>
            <SummaryRow label="Shop Name" value={step2?.shopName} />
          </SummaryCard>

          <SummaryCard title="Payout Setup" icon={Wallet} step={4} goToStep={goToStep}>
            <SummaryRow
              label="Method"
              value={
                payout?.payoutMethod ? (
                  <span>
                    {label(PAYOUT_METHOD_LABELS, payout.payoutMethod)}{' '}
                    <span className="tabular-nums" style={{ color: PALETTE.ink2 }}>
                      ({payoutRail.pct}% + ${payoutRail.fixed}, ${PAYOUT_MIN_USD} min)
                    </span>
                  </span>
                ) : undefined
              }
            />
            {payout?.payoutMethod === 'bank_transfer' && (
              <>
                <SummaryRow label="Bank" value={payout.bankName} />
                <SummaryRow label="Account Holder" value={payout.accountHolderName} />
              </>
            )}
            {payout?.payoutMethod === 'crypto' && (
              <SummaryRow label="Coin" value={label(CRYPTO_TYPE_LABELS, payout.cryptoType)} />
            )}
            <SummaryRow label="Tax Residency" value={payout?.taxResidencyCountry} />
            {state.payoutCurrency && (
              <SummaryRow label="Payout Currency" value={state.payoutCurrency} />
            )}
          </SummaryCard>
        </section>

        {/* ── Selling experience (REQUIRED, compact) ────────────────────────── */}
        <section
          className="rounded-xl p-4"
          style={{ backgroundColor: PALETTE.paper, border: `1px solid ${PALETTE.line}` }}
        >
          <label
            htmlFor="sellingExperience"
            className="block text-sm font-medium"
            style={{ color: PALETTE.ink }}
          >
            Selling Experience <span style={{ color: '#B42318' }}>*</span>
          </label>
          <p className="mt-0.5 text-xs" style={{ color: PALETTE.ink2 }}>
            Where have you sold before? Marketplaces, store links, or a short
            summary — a few lines.
          </p>
          <textarea
            id="sellingExperience"
            rows={3}
            {...register('sellingExperience')}
            placeholder="e.g. 2 years on PlayerAuctions (300+ orders) — playerauctions.com/store/…"
            className="mt-2.5 w-full resize-none rounded-lg px-3.5 py-2.5 text-sm outline-none transition-shadow"
            style={{
              backgroundColor: PALETTE.paper,
              border: `1px solid ${PALETTE.line}`,
              color: PALETTE.ink,
            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(27,94,58,0.18)'
              e.currentTarget.style.borderColor = PALETTE.forest2
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = 'none'
              e.currentTarget.style.borderColor = PALETTE.line
            }}
          />
          {errors.sellingExperience && (
            <p className="mt-1.5 text-xs" style={{ color: '#B42318' }}>
              {errors.sellingExperience.message}
            </p>
          )}
        </section>

        {/* ── Consolidated consent ──────────────────────────────────────────── */}
        <section className="space-y-4">
          <div
            className="rounded-xl p-4"
            style={{ backgroundColor: PALETTE.paper, border: `1px solid ${PALETTE.line}` }}
          >
            <button
              type="button"
              onClick={() =>
                setValue('consolidatedConsent', (consolidatedConsent ? false : true) as true, {
                  shouldValidate: true,
                })
              }
              className="flex w-full items-start gap-3 text-left"
            >
              <span
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition-colors"
                style={{
                  border: `2px solid ${consolidatedConsent ? PALETTE.forest2 : PALETTE.line}`,
                  backgroundColor: consolidatedConsent ? PALETTE.forest2 : PALETTE.paper,
                }}
              >
                {consolidatedConsent && (
                  <Check className="h-3 w-3" strokeWidth={3} style={{ color: PALETTE.lime }} />
                )}
              </span>
              <span className="text-sm leading-relaxed" style={{ color: PALETTE.ink }}>
                I agree to the{' '}
                <ConsentLink href="/terms">Terms of Service</ConsentLink>,{' '}
                <ConsentLink href="/privacy">Privacy Policy</ConsentLink> &amp;{' '}
                <ConsentLink href="/fees">Fee Schedule</ConsentLink>.
              </span>
            </button>
            {errors.consolidatedConsent && (
              <p className="ml-8 mt-1.5 text-xs" style={{ color: '#B42318' }}>
                {errors.consolidatedConsent.message}
              </p>
            )}
          </div>

          {/* Seller Agency Agreement signature */}
          <div
            className="rounded-xl p-4"
            style={{ backgroundColor: PALETTE.paper, border: `1px solid ${PALETTE.line}` }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold" style={{ color: PALETTE.forest }}>
                  Seller Agency Agreement
                </h4>
                <p className="mt-0.5 text-xs leading-relaxed" style={{ color: PALETTE.ink2 }}>
                  {isSigned
                    ? 'Signed — you can re-sign if you need to correct the name.'
                    : 'Sign to appoint DropMarket as your disclosed commercial agent.'}
                </p>
              </div>
              {isSigned && (
                <span
                  className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
                  style={{ backgroundColor: 'rgba(20,67,42,0.08)', color: PALETTE.forest2 }}
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Signed
                </span>
              )}
            </div>

            {isSigned && (
              <div
                className="mt-3 rounded-lg px-3.5 py-3"
                style={{ backgroundColor: 'rgba(20,67,42,0.04)' }}
              >
                <p
                  className="text-lg"
                  style={{
                    color: PALETTE.forest,
                    fontFamily: 'ui-serif, Georgia, "Times New Roman", serif',
                    fontStyle: 'italic',
                  }}
                >
                  {signatureName}
                </p>
                <p className="mt-0.5 text-xs" style={{ color: PALETTE.ink2 }}>
                  Signed {new Date(signedAt).toLocaleString()}
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => setSignOpen(true)}
              className="mt-3 inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors"
              style={
                isSigned
                  ? { border: `1px solid ${PALETTE.line}`, color: PALETTE.forest }
                  : { backgroundColor: PALETTE.forest, color: '#fff' }
              }
              onMouseEnter={(e) => {
                if (!isSigned) e.currentTarget.style.backgroundColor = PALETTE.forest2
              }}
              onMouseLeave={(e) => {
                if (!isSigned) e.currentTarget.style.backgroundColor = PALETTE.forest
              }}
            >
              <PenLine
                className="h-4 w-4"
                style={{ color: isSigned ? PALETTE.forest2 : PALETTE.lime }}
              />
              {isSigned ? 'Re-sign Agreement' : 'Sign the Seller Agency Agreement'}
            </button>

            {/* Register signature fields so RHF/zod validate them on submit. */}
            <input type="hidden" {...register('signatureName')} />
            <input type="hidden" {...register('signedAt')} />
            {(errors.signatureName || errors.signedAt) && !isSigned && (
              <p className="mt-2 text-xs" style={{ color: '#B42318' }}>
                {errors.signatureName?.message ??
                  'Sign the Seller Agency Agreement to continue.'}
              </p>
            )}
          </div>

          {/* Optional marketing consent (separate, unchecked by default) */}
          <button
            type="button"
            onClick={() => setValue('marketingConsent', !marketingConsent)}
            className="flex w-full items-start gap-3 px-1 text-left"
          >
            <span
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition-colors"
              style={{
                border: `2px solid ${marketingConsent ? PALETTE.forest2 : PALETTE.line}`,
                backgroundColor: marketingConsent ? PALETTE.forest2 : PALETTE.paper,
              }}
            >
              {marketingConsent && (
                <Check className="h-3 w-3" strokeWidth={3} style={{ color: PALETTE.lime }} />
              )}
            </span>
            <span className="text-sm" style={{ color: PALETTE.ink2 }}>
              Send me seller tips, feature updates, and occasional promotions. (Optional)
            </span>
          </button>
          <input type="hidden" {...register('marketingConsent')} />
        </section>

        {/* ── Navigation ────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
            style={{ border: `1px solid ${PALETTE.line}`, color: PALETTE.ink }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(20,67,42,0.04)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>

          <button
            type="submit"
            disabled={isSubmitting}
            className="group inline-flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            style={{ backgroundColor: PALETTE.forest }}
            onMouseEnter={(e) => {
              if (!isSubmitting) e.currentTarget.style.backgroundColor = PALETTE.forest2
            }}
            onMouseLeave={(e) => {
              if (!isSubmitting) e.currentTarget.style.backgroundColor = PALETTE.forest
            }}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting…
              </>
            ) : (
              <>
                <Check className="h-4 w-4" style={{ color: PALETTE.lime }} strokeWidth={3} />
                Submit Application
              </>
            )}
          </button>
        </div>
      </form>

      <SignAgreementModal
        open={signOpen}
        onClose={() => setSignOpen(false)}
        defaultName={step2?.fullLegalName ?? ''}
        onSigned={({ name, signedAt: at }) => {
          setValue('signatureName', name, { shouldValidate: true })
          setValue('signedAt', at, { shouldValidate: true })
        }}
      />
    </div>
  )
}

/** An inline consent link in the "Forest Ledger" light world. */
function ConsentLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium underline underline-offset-2"
      style={{ color: PALETTE.forest2 }}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </a>
  )
}
