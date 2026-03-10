'use client'

/**
 * P6.4 — Admin INFORM Act Client
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
  ShieldCheck, FileText, AlertTriangle, CheckCircle2,
  Clock, Loader2, X, ChevronDown, ChevronUp, RefreshCw, UserX,
} from 'lucide-react'
import {
  certifyInformDisclosure,
  getInformDisclosures,
  runInformThresholdCheck,
} from '@/lib/actions/inform-act'
import type { InformDisclosure } from '@/lib/actions/inform-act'

// ── Types ──────────────────────────────────────────────────────────────────

type RequiredSeller = {
  id: string; username: string | null; email: string | null
  total_sales: number; lifetime_earnings: number; inform_status: string
}

// ── Animation variants ─────────────────────────────────────────────────────

const container = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { staggerChildren: 0.05 } },
}
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }

// ── Status badge ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    submitted:    'bg-amber-500/15 text-amber-400 border-amber-500/20',
    certified:    'bg-green-500/15 text-green-400 border-green-500/20',
    rejected:     'bg-red-500/15 text-red-400 border-red-500/20',
    needs_update: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
    required:     'bg-orange-500/15 text-orange-400 border-orange-500/20',
    not_required: 'bg-white/5 text-white/30 border-white/10',
  }
  return (
    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${map[status] ?? 'bg-white/5 text-white/30'}`}>
      {status.replace('_', ' ')}
    </span>
  )
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
    <div className="border-b border-white/[0.04] last:border-0">
      {/* Row header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white font-medium">
            {disc.username ? `@${disc.username}` : disc.seller_id}
          </p>
          <p className="text-xs text-white/30">{disc.email}</p>
        </div>
        <div className="text-xs text-white/40 hidden sm:block">
          {disc.total_sales ?? 0} sales · ${(disc.lifetime_earnings ?? 0).toFixed(0)}
        </div>
        <StatusBadge status={disc.status} />
        <p className="text-xs text-white/25 hidden md:block">
          {disc.submitted_at ? new Date(disc.submitted_at).toLocaleDateString() : '—'}
        </p>
        {expanded ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
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
            <div className="px-4 pb-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 bg-white/[0.02] rounded-lg p-4 text-sm">
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
                    <span className="text-white/40">{k}</span>
                    <span className="text-white font-medium">{v}</span>
                  </div>
                ))}
              </div>

              {disc.rejection_reason && (
                <p className="text-xs text-red-400 bg-red-500/10 rounded p-2">
                  Rejection reason: {disc.rejection_reason}
                </p>
              )}

              {disc.status === 'submitted' && (
                <div className="flex gap-2">
                  <button
                    disabled={busy}
                    onClick={() => onCertify(disc.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20
                               text-xs font-medium transition-colors disabled:opacity-40"
                  >
                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    Certify
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => onReject(disc.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20
                               text-xs font-medium transition-colors disabled:opacity-40"
                  >
                    <X className="w-3.5 h-3.5" />
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
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#111] border border-white/[0.08] rounded-2xl p-6 max-w-md w-full"
            >
              <h3 className="text-white font-semibold mb-3">Rejection Reason</h3>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="Explain why this disclosure is being rejected…"
                rows={4}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white
                           placeholder:text-white/20 focus:outline-none resize-none mb-4"
              />
              <div className="flex gap-2 justify-end">
                <button onClick={() => setRejectTarget(null)}
                  className="px-4 py-2 rounded-lg text-sm text-white/50 hover:text-white transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={!rejectReason.trim()}
                  className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 text-sm font-medium
                             transition-colors disabled:opacity-40"
                >
                  Reject Disclosure
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 pb-10">
        {/* Header */}
        <motion.div variants={item} className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <ShieldCheck className="w-6 h-6 text-violet-400" />
              <h1 className="text-2xl font-bold text-white">INFORM Act</h1>
            </div>
            <p className="text-white/40 text-sm">Review and certify high-volume seller identity disclosures.</p>
          </div>
          <button
            onClick={handleThresholdScan}
            disabled={scanning}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-500/10 border border-violet-500/20
                       text-violet-400 hover:bg-violet-500/15 transition-colors disabled:opacity-50 text-sm font-medium"
          >
            {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {scanning ? 'Scanning…' : 'Run Threshold Check'}
          </button>
        </motion.div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: 'Pending Review', value: disclosures.length, icon: <Clock className="w-4 h-4 text-amber-400" />, bg: 'bg-amber-500/10' },
            { label: 'Non-Compliant',  value: requiredSellers.length, icon: <UserX className="w-4 h-4 text-red-400" />, bg: 'bg-red-500/10' },
            { label: 'Info',           value: 0, icon: <AlertTriangle className="w-4 h-4 text-blue-400" />, bg: 'bg-blue-500/10' },
          ].map(c => (
            <motion.div key={c.label} variants={item}
              className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${c.bg}`}>{c.icon}</div>
              <div>
                <p className="text-xl font-bold font-mono text-white">{c.value}</p>
                <p className="text-xs text-white/40">{c.label}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Table */}
        <motion.div variants={item} className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-white/[0.06] overflow-x-auto">
            {tabs.map(t => (
              <button key={t.key} onClick={() => handleTabChange(t.key)}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === t.key
                    ? 'text-white border-b-2 border-violet-400'
                    : 'text-white/40 hover:text-white/60'
                }`}>
                {t.label}
              </button>
            ))}
          </div>

          {fetchError && (
            <div className="p-4 text-sm text-red-400 bg-red-500/5">Error: {fetchError}</div>
          )}

          {/* Pending sellers tab */}
          {activeTab === 'pending' && (
            <div>
              {requiredSellers.length === 0 ? (
                <div className="py-12 text-center">
                  <CheckCircle2 className="w-8 h-8 text-green-400/50 mx-auto mb-2" />
                  <p className="text-sm text-white/30">All required sellers have submitted their disclosures.</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/[0.04]">
                      {['Seller', 'Sales', 'Lifetime Revenue', 'Status'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[11px] uppercase tracking-wider text-white/30">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {requiredSellers.map(s => (
                      <tr key={s.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3">
                          <p className="text-sm text-white">{s.username ? `@${s.username}` : s.id}</p>
                          <p className="text-xs text-white/30">{s.email}</p>
                        </td>
                        <td className="px-4 py-3 text-sm font-mono text-white/70">{s.total_sales}</td>
                        <td className="px-4 py-3 text-sm font-mono text-white/70">${s.lifetime_earnings.toFixed(2)}</td>
                        <td className="px-4 py-3"><StatusBadge status={s.inform_status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Disclosures tabs */}
          {(activeTab === 'submitted' || activeTab === 'all') && (
            tabLoading ? (
              <div className="py-12 text-center">
                <Loader2 className="w-6 h-6 animate-spin text-white/30 mx-auto" />
              </div>
            ) : disclosures.length === 0 ? (
              <div className="py-12 text-center">
                <FileText className="w-8 h-8 text-white/20 mx-auto mb-2" />
                <p className="text-sm text-white/30">No disclosures to review.</p>
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
        </motion.div>
      </motion.div>
    </>
  )
}
