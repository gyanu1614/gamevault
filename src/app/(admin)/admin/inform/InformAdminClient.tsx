'use client'

/**
 * P6.4 — Admin INFORM Act Client
 *
 * V53 restyle — rebuilt on the admin kit (PageHeader / StatCard /
 * StatusBadge / TABLE). Entrance animations removed so content is
 * visible straight from the server HTML; only user-triggered
 * transitions (modal, expand/collapse) remain.
 *
 * Sections:
 *  1. Pending sellers tab — sellers who need to submit but haven't
 *  2. Submissions tab — submitted disclosures awaiting review
 *  3. All tab — all disclosures with status filter
 *  4. Certify / Reject actions with rejection reason modal
 */

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  FileText, CheckCircle2, Clock, AlertTriangle,
  Loader2, X, ChevronDown, ChevronUp, RefreshCw, UserX,
} from 'lucide-react'
import {
  certifyInformDisclosure,
  getInformDisclosures,
  runInformThresholdCheck,
} from '@/lib/actions/inform-act'
import type { InformDisclosure } from '@/lib/actions/inform-act'
import {
  PageHeader, StatCard, StatusBadge, TABLE, type ChipTone,
} from '../components/kit'

// ── Types ──────────────────────────────────────────────────────────────────

type RequiredSeller = {
  id: string; username: string | null; email: string | null
  total_sales: number; lifetime_earnings: number; inform_status: string
}

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

// ── Disclosure detail panel (expandable) ───────────────────────────────────

function DisclosureRow({
  disc, onCertify, onReject, loading,
}: {
  disc: InformDisclosure & { username?: string | null; email?: string | null; total_sales?: number; lifetime_earnings?: number }
  onCertify: (id: string) => void
  onReject:  (id: string) => void
  loading:   string | null
}) {
  const [expanded, setExpanded] = useState(false)
  const busy = loading === disc.id

  return (
    <div className="border-b border-border-subtle last:border-0">
      {/* Row header */}
      <div
        className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-bg-overlay"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold text-text-primary">
            {disc.username ? `@${disc.username}` : disc.seller_id}
          </p>
          <p className="text-xs text-text-tertiary">{disc.email}</p>
        </div>
        <div className="hidden text-xs tabular-nums text-text-tertiary sm:block">
          {disc.total_sales ?? 0} sales · ${(disc.lifetime_earnings ?? 0).toFixed(0)}
        </div>
        <InformStatusBadge status={disc.status} />
        <p className="hidden text-xs text-text-tertiary md:block">
          {disc.submitted_at ? new Date(disc.submitted_at).toLocaleDateString() : '—'}
        </p>
        {expanded ? <ChevronUp className="h-4 w-4 text-text-tertiary" /> : <ChevronDown className="h-4 w-4 text-text-tertiary" />}
      </div>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 px-4 pb-4">
              <div className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-lg border border-border-subtle bg-bg-overlay p-4 text-sm sm:grid-cols-2">
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
                  <div key={k} className="flex justify-between">
                    <span className="text-text-tertiary">{k}</span>
                    <span className="font-semibold text-text-primary">{v}</span>
                  </div>
                ))}
              </div>

              {disc.rejection_reason && (
                <p className="rounded-lg border border-[rgba(255,92,92,0.25)] bg-error-bg p-2 text-xs text-error">
                  Rejection reason: {disc.rejection_reason}
                </p>
              )}

              {disc.status === 'submitted' && (
                <div className="flex gap-2">
                  <button
                    disabled={busy}
                    onClick={() => onCertify(disc.id)}
                    className="flex items-center gap-1.5 rounded-lg border border-[rgba(63,217,134,0.25)] bg-success-bg px-3 py-1.5
                               text-xs font-semibold text-success transition-colors hover:bg-[rgba(63,217,134,0.22)] disabled:opacity-40"
                  >
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    Certify
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => onReject(disc.id)}
                    className="flex items-center gap-1.5 rounded-lg border border-[rgba(255,92,92,0.25)] bg-error-bg px-3 py-1.5
                               text-xs font-semibold text-error transition-colors hover:bg-[rgba(255,92,92,0.22)] disabled:opacity-40"
                  >
                    <X className="h-3.5 w-3.5" />
                    Reject
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
  const [disclosures,     setDisclosures]     = useState<InformDisclosure[]>(initialDisclosures)
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
    if (result.success) setDisclosures(result.disclosures ?? [])
    else toast.error('Failed to load disclosures')
  }

  // ── Certify ──────────────────────────────────────────────────────────────

  const handleCertify = async (discId: string) => {
    setLoading(discId)
    const result = await certifyInformDisclosure(discId, 'certified')
    setLoading(null)
    if (result.success) {
      toast.success('Disclosure certified')
      setDisclosures(prev => prev.filter(d => d.id !== discId))
    } else {
      toast.error(result.error ?? 'Certification failed')
    }
  }

  // ── Reject ───────────────────────────────────────────────────────────────

  const openReject = (discId: string) => { setRejectTarget(discId); setRejectReason('') }

  const handleReject = async () => {
    if (!rejectTarget) return
    setLoading(rejectTarget)
    const result = await certifyInformDisclosure(rejectTarget, 'rejected', rejectReason)
    setLoading(null)
    setRejectTarget(null)
    if (result.success) {
      toast.success('Disclosure rejected')
      setDisclosures(prev => prev.filter(d => d.id !== rejectTarget))
    } else {
      toast.error(result.error ?? 'Rejection failed')
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'submitted', label: `Pending Review (${disclosures.length})` },
    { key: 'pending',   label: `Required Sellers (${requiredSellers.length})` },
    { key: 'all',       label: 'All Disclosures' },
  ]

  return (
    <>
      {/* Reject reason modal */}
      <AnimatePresence>
        {rejectTarget && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md rounded-xl border border-border-default bg-bg-raised p-6"
            >
              <h3 className="mb-3 font-semibold text-text-primary">Rejection Reason</h3>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="Explain why this disclosure is being rejected…"
                rows={4}
                className="mb-4 w-full resize-none rounded-lg border border-border-default bg-bg-base px-3 py-2.5 text-sm
                           text-text-primary placeholder:text-text-disabled focus:border-lime focus:outline-none"
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setRejectTarget(null)}
                  className="rounded-lg px-4 py-2 text-sm text-text-tertiary transition-colors hover:text-text-primary">
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={!rejectReason.trim()}
                  className="rounded-lg border border-[rgba(255,92,92,0.25)] bg-error-bg px-4 py-2 text-sm font-semibold text-error
                             transition-colors hover:bg-[rgba(255,92,92,0.22)] disabled:opacity-40"
                >
                  Reject Disclosure
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-6 pb-10">
        {/* Header */}
        <PageHeader
          title="INFORM Act"
          description="Review and certify high-volume seller identity disclosures."
          className="mb-0"
          actions={
            <button
              onClick={handleThresholdScan}
              disabled={scanning}
              className="flex items-center gap-2 rounded-lg bg-lime-pressed px-4 py-2 text-sm font-bold text-text-inverse
                         transition-colors hover:bg-lime disabled:opacity-50"
            >
              {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {scanning ? 'Scanning…' : 'Run Threshold Check'}
            </button>
          }
        />

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard label="Pending Review" value={disclosures.length}     icon={Clock}         tone="warning" />
          <StatCard label="Non-Compliant"  value={requiredSellers.length} icon={UserX}         tone="error" />
          <StatCard label="Info"           value={0}                      icon={AlertTriangle} tone="info" />
        </div>

        {/* Table */}
        <section className="overflow-hidden rounded-xl border border-border-default bg-bg-raised">
          {/* Tabs */}
          <div className="flex overflow-x-auto border-b border-border-subtle">
            {tabs.map(t => (
              <button key={t.key} onClick={() => handleTabChange(t.key)}
                className={`whitespace-nowrap px-4 py-3 text-sm font-semibold transition-colors ${
                  activeTab === t.key
                    ? 'border-b-2 border-lime text-text-primary'
                    : 'text-text-tertiary hover:text-text-secondary'
                }`}>
                {t.label}
              </button>
            ))}
          </div>

          {fetchError && (
            <div className="bg-error-bg p-4 text-sm text-error">Error: {fetchError}</div>
          )}

          {/* Pending sellers tab */}
          {activeTab === 'pending' && (
            <div>
              {requiredSellers.length === 0 ? (
                <div className="py-12 text-center">
                  <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-success" />
                  <p className="text-sm text-text-tertiary">All required sellers have submitted their disclosures.</p>
                </div>
              ) : (
                <div className={TABLE.wrap}>
                  <table className={TABLE.table}>
                    <thead>
                      <tr>
                        {['Seller', 'Sales', 'Lifetime Revenue', 'Status'].map(h => (
                          <th key={h} className={TABLE.th}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {requiredSellers.map(s => (
                        <tr key={s.id} className={TABLE.row}>
                          <td className={TABLE.td}>
                            <p className="text-[13.5px] font-semibold text-text-primary">{s.username ? `@${s.username}` : s.id}</p>
                            <p className="text-xs text-text-tertiary">{s.email}</p>
                          </td>
                          <td className={`${TABLE.td} tabular-nums`}>{s.total_sales}</td>
                          <td className={`${TABLE.td} tabular-nums`}>${s.lifetime_earnings.toFixed(2)}</td>
                          <td className={TABLE.td}><InformStatusBadge status={s.inform_status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Disclosures tabs */}
          {(activeTab === 'submitted' || activeTab === 'all') && (
            tabLoading ? (
              <div className="py-12 text-center">
                <Loader2 className="mx-auto h-6 w-6 animate-spin text-text-tertiary" />
              </div>
            ) : disclosures.length === 0 ? (
              <div className="py-12 text-center">
                <FileText className="mx-auto mb-2 h-8 w-8 text-text-disabled" />
                <p className="text-sm text-text-tertiary">No disclosures to review.</p>
              </div>
            ) : (
              <div>
                {disclosures.map(disc => (
                  <DisclosureRow
                    key={disc.id}
                    disc={disc as any}
                    onCertify={handleCertify}
                    onReject={openReject}
                    loading={loading}
                  />
                ))}
              </div>
            )
          )}
        </section>
      </div>
    </>
  )
}
