'use client'

/**
 * P6.4 — INFORM Consumers Act Seller Disclosure Client
 *
 * Shows:
 *  - If not_required: informational message + threshold info
 *  - If required/rejected: multi-field disclosure form
 *  - If submitted: pending review message
 *  - If certified: confirmation with green badge
 */

import { useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import AccountPageHeader from '@/components/account/AccountPageHeader'
import {
  ShieldCheck, FileText, AlertTriangle, CheckCircle2,
  Clock, Loader2, ChevronRight, Info,
} from 'lucide-react'
import { submitInformDisclosure } from '@/lib/actions/inform-act'
import type { InformDisclosure } from '@/lib/actions/inform-act'

// ── Animation variants ─────────────────────────────────────────────────────

const container = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { staggerChildren: 0.07 } },
}
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }

// ── Input component ────────────────────────────────────────────────────────

function Field({
  label, name, value, onChange, required = false, placeholder = '', type = 'text', hint,
}: {
  label: string; name: string; value: string; onChange: (v: string) => void
  required?: boolean; placeholder?: string; type?: string; hint?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-text-secondary mb-1.5">
        {label}{required && <span className="text-error ml-0.5">*</span>}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full bg-bg-raised border border-border-subtle rounded-lg px-3 py-2.5 text-sm text-white
                   placeholder:text-text-disabled focus:outline-none focus:border-lime transition-colors"
      />
      {hint && <p className="text-xs text-text-tertiary mt-1">{hint}</p>}
    </div>
  )
}

// ── Status display ─────────────────────────────────────────────────────────

function StatusBanner({ status, rejectionReason }: { status: string; rejectionReason?: string | null }) {
  if (status === 'certified') {
    return (
      <div className="flex items-start gap-3 bg-success-bg border border-success/20 rounded-lg p-4">
        <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-success">Disclosure Certified</p>
          <p className="text-xs text-text-secondary mt-0.5">
            Your identity has been verified. You are compliant with INFORM Act requirements.
          </p>
        </div>
      </div>
    )
  }
  if (status === 'submitted') {
    return (
      <div className="flex items-start gap-3 bg-warning-bg border border-warning/20 rounded-lg p-4">
        <Clock className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-warning">Under Review</p>
          <p className="text-xs text-text-secondary mt-0.5">
            We've received your disclosure and are verifying the information. This typically takes 1-3 business days.
          </p>
        </div>
      </div>
    )
  }
  if (status === 'rejected') {
    return (
      <div className="flex items-start gap-3 bg-error-bg border border-error/40 rounded-lg p-4">
        <AlertTriangle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-error">Disclosure Rejected — Resubmission Required</p>
          {rejectionReason && (
            <p className="text-xs text-text-secondary mt-0.5">Reason: {rejectionReason}</p>
          )}
        </div>
      </div>
    )
  }
  return null
}

// ── Main component ─────────────────────────────────────────────────────────

interface Props {
  status:            string
  disclosure:        InformDisclosure | null
  required:          boolean
  salesThreshold:    number
  revenueThreshold:  number
}

const INITIAL_FORM = {
  legalName:     '',
  addressLine1:  '',
  addressLine2:  '',
  city:          '',
  stateProvince: '',
  postalCode:    '',
  country:       'US',
  taxIdLast4:    '',
  bankLast4:     '',
  contactEmail:  '',
  contactPhone:  '',
}

export default function InformDisclosureClient({
  status, disclosure, required, salesThreshold, revenueThreshold,
}: Props) {
  const [form,     setForm]     = useState(INITIAL_FORM)
  const [saving,   setSaving]   = useState(false)
  const [consented, setConsented] = useState(false)

  const set = (k: keyof typeof INITIAL_FORM) => (v: string) =>
    setForm(prev => ({ ...prev, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!consented) { toast.error('You must confirm the accuracy of your information.'); return }
    setSaving(true)
    const result = await submitInformDisclosure({
      legalName:     form.legalName,
      addressLine1:  form.addressLine1,
      addressLine2:  form.addressLine2 || undefined,
      city:          form.city,
      stateProvince: form.stateProvince,
      postalCode:    form.postalCode,
      country:       form.country,
      taxIdLast4:    form.taxIdLast4,
      bankLast4:     form.bankLast4 || undefined,
      contactEmail:  form.contactEmail,
      contactPhone:  form.contactPhone,
    })
    setSaving(false)
    if (result.success) {
      toast.success('Disclosure submitted — thank you.')
      window.location.reload()
    } else {
      toast.error(result.error ?? 'Submission failed')
    }
  }

  // ── Not required ─────────────────────────────────────────────────────────
  if (!required) {
    return (
      <motion.div variants={container} initial="hidden" animate="show" className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 space-y-6 pb-10">
        <motion.div variants={item}>
          {/* V21/P7.al — Standard account header. */}
          <AccountPageHeader
            icon="inform"
            title="INFORM Act Compliance"
            subtitle="Identity verification for high-volume sellers."
          />
        </motion.div>

        <motion.div variants={item} className="rounded-lg border border-border-subtle card-frost p-5">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-lime-text flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-white mb-2">No Action Required</p>
              <p className="text-sm text-text-secondary">
                The INFORM Consumers Act requires identity verification for sellers who exceed:
              </p>
              <ul className="mt-2 space-y-1 text-sm text-text-secondary">
                <li><ChevronRight className="w-3.5 h-3.5 inline mr-1 text-text-tertiary" />{salesThreshold}+ transactions, OR</li>
                <li><ChevronRight className="w-3.5 h-3.5 inline mr-1 text-text-tertiary" />${revenueThreshold.toLocaleString()}+ in gross sales</li>
              </ul>
              <p className="mt-3 text-sm text-text-tertiary">
                You have not yet reached these thresholds. We'll notify you if this changes.
              </p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    )
  }

  // ── Certified or submitted — show status, no form ─────────────────────
  if (status === 'certified' || status === 'submitted') {
    return (
      <motion.div variants={container} initial="hidden" animate="show" className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 space-y-6 pb-10">
        <motion.div variants={item}>
          <h1 className="text-2xl font-bold text-white mb-1 flex items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 text-lime-text" />
            INFORM Act Disclosure
          </h1>
        </motion.div>
        <motion.div variants={item}>
          <StatusBanner status={status} rejectionReason={disclosure?.rejection_reason} />
        </motion.div>
        {disclosure && (
          <motion.div variants={item} className="rounded-lg border border-border-subtle card-frost p-5 space-y-2">
            <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider mb-3">Submitted Information</p>
            {[
              ['Legal Name',    disclosure.legal_name],
              ['Address',       `${disclosure.address_line1}${disclosure.address_line2 ? ', ' + disclosure.address_line2 : ''}, ${disclosure.city}, ${disclosure.state_province} ${disclosure.postal_code}, ${disclosure.country}`],
              ['Tax ID',        `•••-••-${disclosure.tax_id_last4}`],
              ['Contact Email', disclosure.contact_email],
              ['Contact Phone', disclosure.contact_phone],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm">
                <span className="text-text-tertiary">{k}</span>
                <span className="text-white">{v}</span>
              </div>
            ))}
          </motion.div>
        )}
      </motion.div>
    )
  }

  // ── Required or rejected — show form ─────────────────────────────────────
  return (
    <motion.div variants={container} initial="hidden" animate="show" className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 space-y-6 pb-10">
      <motion.div variants={item}>
        <h1 className="text-2xl font-bold text-white mb-1 flex items-center gap-2.5">
          <FileText className="w-6 h-6 text-warning" />
          INFORM Act Disclosure Required
        </h1>
        <p className="text-text-tertiary text-sm">
          You've reached the high-volume seller threshold. US law requires us to collect and verify
          the following information. This data is kept confidential and used solely for regulatory compliance.
        </p>
      </motion.div>

      {status === 'rejected' && disclosure && (
        <motion.div variants={item}>
          <StatusBanner status="rejected" rejectionReason={disclosure.rejection_reason} />
        </motion.div>
      )}

      <motion.div variants={item}>
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Identity */}
          <div className="rounded-lg border border-border-subtle card-frost p-5 space-y-4">
            <p className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">Legal Identity</p>
            <Field label="Legal Full Name or Business Name" name="legalName" value={form.legalName}
              onChange={set('legalName')} required placeholder="Jane Doe or Acme LLC" />
            <Field label="Address Line 1" name="addressLine1" value={form.addressLine1}
              onChange={set('addressLine1')} required placeholder="123 Main St" />
            <Field label="Address Line 2 (optional)" name="addressLine2" value={form.addressLine2}
              onChange={set('addressLine2')} placeholder="Apt 4B" />
            <div className="grid grid-cols-2 gap-4">
              <Field label="City" name="city" value={form.city} onChange={set('city')} required placeholder="New York" />
              <Field label="State / Province" name="stateProvince" value={form.stateProvince}
                onChange={set('stateProvince')} required placeholder="NY" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Postal Code" name="postalCode" value={form.postalCode}
                onChange={set('postalCode')} required placeholder="10001" />
              <Field label="Country" name="country" value={form.country} onChange={set('country')} required placeholder="US" />
            </div>
          </div>

          {/* Financial identifiers */}
          <div className="rounded-lg border border-border-subtle card-frost p-5 space-y-4">
            <p className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">Financial Identifiers</p>
            <Field label="Tax ID — Last 4 digits only (SSN or EIN)" name="taxIdLast4" value={form.taxIdLast4}
              onChange={set('taxIdLast4')} required placeholder="4321"
              hint="We store only the last 4 digits for verification purposes." />
            <Field label="Bank Account — Last 4 digits (optional if Stripe Connected)" name="bankLast4" value={form.bankLast4}
              onChange={set('bankLast4')} placeholder="8765"
              hint="If you've connected Stripe, this will be verified automatically." />
          </div>

          {/* Public contact */}
          <div className="rounded-lg border border-border-subtle card-frost p-5 space-y-4">
            <p className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">Public Contact Information</p>
            <p className="text-xs text-text-tertiary">
              Under the INFORM Act, buyers may request this contact information. It will only be
              shared in response to a valid consumer request, not displayed publicly on your profile.
            </p>
            <Field label="Contact Email" name="contactEmail" type="email" value={form.contactEmail}
              onChange={set('contactEmail')} required placeholder="seller@example.com" />
            <Field label="Contact Phone" name="contactPhone" type="tel" value={form.contactPhone}
              onChange={set('contactPhone')} required placeholder="+1 555 000 0000" />
          </div>

          {/* Consent checkbox */}
          <div
            onClick={() => setConsented(v => !v)}
            className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
              consented
                ? 'bg-lime/10 border-lime-tint-border'
                : 'bg-bg-overlay border-border-subtle hover:border-white/[0.1]'
            }`}
          >
            <div className={`w-4 h-4 mt-0.5 rounded flex-shrink-0 border transition-colors ${
              consented ? 'bg-lime border-lime-tint-border' : 'border-white/20'
            }`}>
              {consented && (
                <svg viewBox="0 0 12 12" fill="none" className="w-full h-full p-0.5">
                  <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <p className="text-xs text-text-secondary">
              I certify that the information provided above is accurate and complete to the best of my knowledge.
              I understand that providing false information is a violation of DropMarket's Terms of Service and
              may be subject to legal penalties under applicable law.
            </p>
          </div>

          <button
            type="submit"
            disabled={saving || !consented}
            className="w-full py-3 rounded-lg bg-lime hover:bg-lime-hover text-text-inverse font-semibold text-sm
                       transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Submitting…' : 'Submit Disclosure'}
          </button>
        </form>
      </motion.div>
    </motion.div>
  )
}
