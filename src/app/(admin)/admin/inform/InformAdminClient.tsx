'use client'

/**
 * P6.4 — Admin INFORM Act Client
 *
 * Built on the admin kit. Content is visible straight from the server
 * HTML; only user-triggered transitions (dialog, expand/collapse) animate.
 *
 * Sections:
 *  1. Pending Review tab — submitted disclosures awaiting review
 *  2. Required Sellers tab — sellers who need to submit but haven't
 *  3. All tab — every disclosure
 *  4. Certify / Reject actions with a rejection-reason dialog
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { ArrowsClockwise, CaretDown, CheckCircle, CircleNotch, FileText, X } from '@phosphor-icons/react'
import {
  certifyInformDisclosure,
  getInformDisclosures,
  runInformThresholdCheck,
} from '@/lib/actions/inform-act'
import type { InformDisclosure } from '@/lib/actions/inform-act'
import { StatStrip, accountInputCls } from '@/components/account/AccountSurface'
import { SegmentedTabs, TabCount } from '@/components/account/SegmentedTabs'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import {
  AdminEmpty, AdminLoadingRows, PageHeader, StatusBadge, adminBtn, adminBtnSm, type ChipTone,
} from '../components/kit'

// ── Types ──────────────────────────────────────────────────────────────────

type RequiredSeller = {
  id: string; username: string | null; email: string | null
  total_sales: number; lifetime_earnings: number; inform_status: string
}

type Disc = InformDisclosure & { username?: string | null; email?: string | null; total_sales?: number; lifetime_earnings?: number }

// ── Status badge (INFORM-specific tone mapping over the kit badge) ─────────

const INFORM_TONE: Record<string, ChipTone> = {
  submitted:    'warning',
  certified:    'success',
  rejected:     'error',
  needs_update: 'info',
  required:     'warning',
  not_required: 'neutral',
}

function InformStatusBadge({ status }: { status: string }) {
  return <StatusBadge status={status} tone={INFORM_TONE[status] ?? 'neutral'} />
}

// ── Disclosure row (expandable) ────────────────────────────────────────────

function DisclosureRow({
  disc, onCertify, onReject, loading,
}: {
  disc: Disc
  onCertify: (id: string) => void
  onReject:  (id: string) => void
  loading:   string | null
}) {
  const [expanded, setExpanded] = useState(false)
  const busy = loading === disc.id
  const panelId = `inform-disc-${disc.id}`

  return (
    <li>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded(v => !v)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.03]"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-semibold text-text-primary">
            {disc.username ? `@${disc.username}` : disc.seller_id}
          </p>
          <p className="truncate text-[12px] text-text-tertiary">
            {disc.email}
            <span className="sm:hidden"> · {disc.total_sales ?? 0} sales</span>
          </p>
        </div>
        <span className="hidden shrink-0 text-[12.5px] tabular-nums text-text-tertiary sm:block">
          {disc.total_sales ?? 0} sales · ${(disc.lifetime_earnings ?? 0).toFixed(0)}
        </span>
        <span className="hidden w-24 shrink-0 text-right text-[12.5px] text-text-tertiary md:block">
          {disc.submitted_at ? new Date(disc.submitted_at).toLocaleDateString() : '—'}
        </span>
        <InformStatusBadge status={disc.status} />
        <CaretDown
          aria-hidden
          weight="bold"
          className={cn('h-4 w-4 shrink-0 text-text-tertiary transition-transform', expanded && 'rotate-180')}
        />
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            id={panelId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 px-4 pb-4">
              <dl className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-md bg-bg-overlay p-4 text-[13px] sm:grid-cols-2">
                {[
                  ['Legal Name',    disc.legal_name],
                  ['Address',       `${disc.address_line1}${disc.address_line2 ? ', ' + disc.address_line2 : ''}`],
                  ['City / State',  `${disc.city}, ${disc.state_province} ${disc.postal_code}`],
                  ['Country',       disc.country],
                  ['Tax ID',        `•••-••-${disc.tax_id_last4}`],
                  ['Bank Acct',     disc.bank_last4 ? `••••${disc.bank_last4}` : '—'],
                  ['Contact Email', disc.contact_email],
                  ['Contact Phone', disc.contact_phone],
                  ['Version',       `v${disc.version}`],
                  ['Consented At',  new Date(disc.consented_at).toLocaleString()],
                ].map(([k, v]) => (
                  <div key={k} className="flex min-w-0 justify-between gap-3">
                    <dt className="shrink-0 text-text-tertiary">{k}</dt>
                    <dd className="min-w-0 truncate text-right font-medium text-text-primary">{v}</dd>
                  </div>
                ))}
              </dl>

              {disc.rejection_reason && (
                <p className="rounded-md bg-error-bg px-3.5 py-2.5 text-[13px] text-text-secondary">
                  <span className="font-semibold text-error">Rejection reason: </span>
                  {disc.rejection_reason}
                </p>
              )}

              {disc.status === 'submitted' && (
                <div className="flex gap-1.5">
                  <button type="button" disabled={busy} onClick={() => onCertify(disc.id)} className={adminBtnSm.primary}>
                    {busy ? (
                      <CircleNotch aria-hidden weight="bold" className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCircle aria-hidden weight="bold" className="h-3.5 w-3.5" />
                    )}
                    Certify
                  </button>
                  <button type="button" disabled={busy} onClick={() => onReject(disc.id)} className={adminBtnSm.danger}>
                    <X aria-hidden weight="bold" className="h-3.5 w-3.5" />
                    Reject
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

type Tab = 'pending' | 'submitted' | 'all'

interface Props {
  initialDisclosures: InformDisclosure[]
  requiredSellers:    RequiredSeller[]
  fetchError?:        string
}

export default function InformAdminClient({ initialDisclosures, requiredSellers, fetchError }: Props) {
  const router = useRouter()
  const [disclosures,     setDisclosures]     = useState<InformDisclosure[]>(initialDisclosures)
  /** Submitted-and-unreviewed count, kept apart from whichever list is showing. */
  const [submittedCount,  setSubmittedCount]  = useState(initialDisclosures.length)
  const [activeTab,       setActiveTab]       = useState<Tab>('submitted')
  const [loading,         setLoading]         = useState<string | null>(null)
  const [tabLoading,      setTabLoading]      = useState(false)
  const [scanning,        setScanning]        = useState(false)
  const [rejectTarget,    setRejectTarget]    = useState<string | null>(null)
  const [rejectReason,    setRejectReason]    = useState('')

  // ── Run threshold scan ───────────────────────────────────────────────────

  const handleThresholdScan = async () => {
    setScanning(true)
    const result = await runInformThresholdCheck()
    setScanning(false)
    if (result.success) {
      toast.success(`${result.marked} seller${result.marked !== 1 ? 's' : ''} newly marked as required`)
      // The required-sellers list comes from the server page.
      router.refresh()
    } else {
      toast.error(result.error ?? 'Scan failed')
    }
  }

  // ── Tab change ───────────────────────────────────────────────────────────

  const handleTabChange = async (tab: Tab) => {
    setActiveTab(tab)
    if (tab === 'pending') return // pending sellers use the pre-loaded list
    setTabLoading(true)
    const filter = tab === 'submitted' ? 'submitted' : 'all'
    const result = await getInformDisclosures(filter)
    setTabLoading(false)
    if (result.success) {
      setDisclosures(result.disclosures ?? [])
      if (tab === 'submitted') setSubmittedCount((result.disclosures ?? []).length)
    } else toast.error('Failed to load disclosures')
  }

  const wasSubmitted = (discId: string) => disclosures.find(d => d.id === discId)?.status === 'submitted'

  // ── Certify ──────────────────────────────────────────────────────────────

  const handleCertify = async (discId: string) => {
    setLoading(discId)
    const submitted = wasSubmitted(discId)
    const result = await certifyInformDisclosure(discId, 'certified')
    setLoading(null)
    if (result.success) {
      toast.success('Disclosure certified')
      setDisclosures(prev => prev.filter(d => d.id !== discId))
      if (submitted) setSubmittedCount(n => Math.max(0, n - 1))
    } else {
      toast.error(result.error ?? 'Certification failed')
    }
  }

  // ── Reject ───────────────────────────────────────────────────────────────

  const openReject = (discId: string) => { setRejectTarget(discId); setRejectReason('') }

  const handleReject = async () => {
    if (!rejectTarget) return
    setLoading(rejectTarget)
    const submitted = wasSubmitted(rejectTarget)
    const result = await certifyInformDisclosure(rejectTarget, 'rejected', rejectReason)
    setLoading(null)
    setRejectTarget(null)
    if (result.success) {
      toast.success('Disclosure rejected')
      setDisclosures(prev => prev.filter(d => d.id !== rejectTarget))
      if (submitted) setSubmittedCount(n => Math.max(0, n - 1))
    } else {
      toast.error(result.error ?? 'Rejection failed')
    }
  }

  return (
    <div className="space-y-5 pb-10">
      <PageHeader
        title="INFORM Act"
        description="Review and certify high-volume seller identity disclosures."
        className="mb-0 sm:mb-0"
        actions={
          <button type="button" onClick={handleThresholdScan} disabled={scanning} className={adminBtn.primary}>
            {scanning ? (
              <CircleNotch aria-hidden weight="bold" className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowsClockwise aria-hidden weight="bold" className="h-4 w-4" />
            )}
            {scanning ? 'Scanning…' : 'Run Threshold Check'}
          </button>
        }
      />

      <StatStrip
        stats={[
          {
            label: 'Pending Review',
            value: <span className={submittedCount > 0 ? 'text-warning' : undefined}>{submittedCount}</span>,
            hint: 'Not yet certified',
          },
          {
            label: 'Required Sellers',
            value: <span className={requiredSellers.length > 0 ? 'text-error' : undefined}>{requiredSellers.length}</span>,
            hint: 'Not submitted yet',
          },
        ]}
      />

      <SegmentedTabs<Tab>
        tabs={[
          { id: 'submitted', label: <>Pending Review <TabCount n={submittedCount} /></> },
          { id: 'pending', label: <>Required Sellers <TabCount n={requiredSellers.length} /></> },
          { id: 'all', label: 'All Disclosures' },
        ]}
        value={activeTab}
        onChange={handleTabChange}
        layoutId="inform-tabs"
        ariaLabel="INFORM disclosures"
      />

      <div role="tabpanel" id={`inform-tabs-panel-${activeTab}`} aria-labelledby={`inform-tabs-tab-${activeTab}`} className="space-y-3">
        {fetchError && <p className="rounded-lg bg-error-bg px-4 py-3 text-[13px] text-error">Error: {fetchError}</p>}

        {/* Required sellers tab */}
        {activeTab === 'pending' &&
          (requiredSellers.length === 0 ? (
            <AdminEmpty
              icon={CheckCircle}
              tone="success"
              title="Everyone's Compliant"
              hint="All required sellers have submitted their disclosures."
            />
          ) : (
            <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-lg bg-bg-raised">
              {requiredSellers.map(s => (
                <li key={s.id} className="flex items-center gap-3 px-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-semibold text-text-primary">{s.username ? `@${s.username}` : s.id}</p>
                    <p className="truncate text-[12px] text-text-tertiary">{s.email}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[13px] font-semibold tabular-nums text-text-primary">${s.lifetime_earnings.toFixed(2)}</p>
                    <p className="text-[12px] tabular-nums text-text-tertiary">{s.total_sales} sales</p>
                  </div>
                  <InformStatusBadge status={s.inform_status} />
                </li>
              ))}
            </ul>
          ))}

        {/* Disclosures tabs */}
        {(activeTab === 'submitted' || activeTab === 'all') &&
          (tabLoading ? (
            <AdminLoadingRows rows={4} />
          ) : disclosures.length === 0 ? (
            <AdminEmpty icon={FileText} title="No Disclosures to Review" hint="Submitted seller disclosures show up here." />
          ) : (
            <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-lg bg-bg-raised">
              {disclosures.map(disc => (
                <DisclosureRow
                  key={disc.id}
                  disc={disc as Disc}
                  onCertify={handleCertify}
                  onReject={openReject}
                  loading={loading}
                />
              ))}
            </ul>
          ))}
      </div>

      {/* Reject reason dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={o => !o && setRejectTarget(null)}>
        <DialogContent className="max-w-[460px] border-0 p-5 sm:p-6">
          <div className="pr-8">
            <DialogTitle className="text-[18px] font-bold leading-tight">Reject Disclosure</DialogTitle>
            <DialogDescription className="mt-1.5 leading-relaxed">
              The seller sees your reason and resubmits.
            </DialogDescription>
          </div>
          <div>
            <label htmlFor="inform-reject-reason" className="mb-1.5 block text-[13px] font-medium text-text-secondary">
              Rejection Reason <span className="text-error">*</span>
            </label>
            <textarea
              id="inform-reject-reason"
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Explain why this disclosure is being rejected…"
              rows={4}
              className={cn(accountInputCls, 'resize-none')}
            />
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setRejectTarget(null)} className={adminBtn.secondary}>
              Cancel
            </button>
            <button type="button" onClick={handleReject} disabled={!rejectReason.trim()} className={adminBtn.danger}>
              Reject Disclosure
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
