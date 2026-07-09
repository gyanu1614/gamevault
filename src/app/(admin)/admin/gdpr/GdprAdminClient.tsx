'use client'

/**
 * P6.5 — Admin GDPR Request Management Client
 *
 * V53 restyle — rebuilt on the admin kit (PageHeader / StatCard /
 * AdminPanel / StatusBadge / TABLE). Entrance animations removed so
 * content is visible straight from the server HTML; only user-triggered
 * transitions (modal, row exit) remain.
 *
 * Sections:
 *  1. Request list with status tabs (pending / all)
 *  2. Per-request detail: type, user, date
 *  3. Complete / Reject actions
 *  4. Warning banner for deletion requests
 */

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  Download, Trash2, CheckCircle2, Loader2, AlertTriangle, X,
} from 'lucide-react'
import { processGdprRequest, getGdprRequests } from '@/lib/actions/gdpr'
import type { GdprRequest } from '@/lib/actions/gdpr'
import { PageHeader, StatCard, StatusBadge, TABLE } from '../components/kit'

// ── Request row ────────────────────────────────────────────────────────────

function RequestRow({ req, onComplete, onReject, loading }: {
  req:        GdprRequest & { username?: string | null; email?: string | null }
  onComplete: (id: string) => void
  onReject:   (id: string) => void
  loading:    string | null
}) {
  const busy  = loading === req.id
  const isDel = req.type === 'deletion'

  return (
    <motion.tr
      layout
      initial={false}
      exit={{ opacity: 0 }}
      className={TABLE.row}
    >
      {/* Type */}
      <td className={TABLE.td}>
        <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
          isDel
            ? 'border-[rgba(255,92,92,0.25)] bg-error-bg text-error'
            : 'border-[rgba(88,155,255,0.25)] bg-info-bg text-info'
        }`}>
          {isDel ? <Trash2 className="h-3 w-3" /> : <Download className="h-3 w-3" />}
          {isDel ? 'Deletion' : 'Export'}
        </span>
      </td>

      {/* User */}
      <td className={TABLE.td}>
        <p className="text-[13.5px] font-semibold text-text-primary">{req.username ? `@${req.username}` : '—'}</p>
        <p className="text-[12px] text-text-tertiary">{req.email}</p>
      </td>

      {/* Date */}
      <td className={`${TABLE.td} text-[12px] text-text-tertiary`}>
        {new Date(req.requested_at).toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric',
        })}
      </td>

      {/* Status */}
      <td className={TABLE.td}>
        <StatusBadge status={req.status} />
        {req.rejection_reason && (
          <p className="mt-0.5 max-w-[160px] truncate text-[10px] text-error">{req.rejection_reason}</p>
        )}
      </td>

      {/* Actions */}
      <td className={TABLE.td}>
        {req.status === 'pending' || req.status === 'processing' ? (
          <div className="flex items-center gap-1.5">
            <button
              disabled={busy}
              onClick={() => onComplete(req.id)}
              className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors disabled:opacity-40
                ${isDel
                  ? 'border-[rgba(255,92,92,0.25)] bg-error-bg text-error hover:bg-[rgba(255,92,92,0.22)]'
                  : 'border-[rgba(63,217,134,0.25)] bg-success-bg text-success hover:bg-[rgba(63,217,134,0.22)]'
                }`}
            >
              {busy
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : isDel ? <Trash2 className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />
              }
              {isDel ? 'Delete Account' : 'Mark Done'}
            </button>
            <button
              disabled={busy}
              onClick={() => onReject(req.id)}
              className="flex items-center gap-1 rounded-md border border-border-default bg-bg-overlay px-2 py-1 text-[11px] font-semibold text-text-secondary transition-colors hover:bg-bg-overlay-2 hover:text-text-primary disabled:opacity-40"
            >
              <X className="h-3 w-3" />
              Reject
            </button>
          </div>
        ) : (
          <span className="text-[12px] text-text-tertiary">
            {req.completed_at ? new Date(req.completed_at).toLocaleDateString() : '—'}
          </span>
        )}
      </td>
    </motion.tr>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

type Tab = 'pending' | 'all'

interface Props {
  initialRequests: GdprRequest[]
  fetchError?:     string
}

export default function GdprAdminClient({ initialRequests, fetchError }: Props) {
  const [requests,     setRequests]     = useState<GdprRequest[]>(initialRequests)
  const [activeTab,    setActiveTab]    = useState<Tab>('pending')
  const [loading,      setLoading]      = useState<string | null>(null)
  const [tabLoading,   setTabLoading]   = useState(false)
  const [rejectTarget, setRejectTarget] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  // ── Tab change ────────────────────────────────────────────────────────────

  const handleTabChange = async (tab: Tab) => {
    setActiveTab(tab)
    setTabLoading(true)
    const result = await getGdprRequests(tab === 'pending' ? 'pending' : 'all')
    setTabLoading(false)
    if (result.success) setRequests(result.requests ?? [])
    else toast.error('Failed to load requests')
  }

  // ── Complete ──────────────────────────────────────────────────────────────

  const handleComplete = async (reqId: string) => {
    setLoading(reqId)
    const result = await processGdprRequest(reqId, 'completed')
    setLoading(null)
    if (result.success) {
      toast.success('Request marked as completed')
      setRequests(prev => prev.filter(r => r.id !== reqId))
    } else {
      toast.error(result.error ?? 'Processing failed')
    }
  }

  // ── Reject ────────────────────────────────────────────────────────────────

  const handleReject = async () => {
    if (!rejectTarget) return
    setLoading(rejectTarget)
    const result = await processGdprRequest(rejectTarget, 'rejected', { rejectionReason: rejectReason })
    setLoading(null)
    setRejectTarget(null)
    if (result.success) {
      toast.success('Request rejected')
      setRequests(prev => prev.filter(r => r.id !== rejectTarget))
    } else {
      toast.error(result.error ?? 'Rejection failed')
    }
  }

  const deletionCount = requests.filter(r => r.type === 'deletion').length

  return (
    <>
      {/* Reject modal */}
      <AnimatePresence>
        {rejectTarget && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="w-full max-w-md rounded-xl border border-border-default bg-bg-raised p-6"
            >
              <h3 className="mb-3 font-semibold text-text-primary">Rejection Reason</h3>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="Reason for rejection (e.g., active orders pending, outstanding seller balance)…"
                rows={4}
                className="mb-4 w-full resize-none rounded-lg border border-border-default bg-bg-base px-3 py-2.5 text-sm
                           text-text-primary placeholder:text-text-disabled focus:border-lime focus:outline-none"
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setRejectTarget(null)} className="px-4 py-2 text-sm text-text-tertiary transition-colors hover:text-text-primary">
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={!rejectReason.trim()}
                  className="rounded-lg border border-[rgba(255,92,92,0.25)] bg-error-bg px-4 py-2 text-sm font-semibold text-error transition-colors hover:bg-[rgba(255,92,92,0.22)] disabled:opacity-40"
                >
                  Reject Request
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-6 pb-10">
        {/* Header */}
        <PageHeader
          title="GDPR Requests"
          description="Data export and account deletion requests."
          className="mb-0"
        />

        {/* Deletion warning */}
        {deletionCount > 0 && (
          <div className="flex items-start gap-3 rounded-xl border border-[rgba(255,92,92,0.25)] bg-error-bg p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-error" />
            <div>
              <p className="text-sm font-semibold text-error">{deletionCount} Account Deletion Request{deletionCount !== 1 ? 's' : ''}</p>
              <p className="mt-0.5 text-xs text-text-secondary">
                Completing a deletion request is irreversible. Verify: no active orders, seller balance = 0,
                no pending payouts. The auth user will be permanently deleted.
              </p>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Pending"    value={requests.filter(r => r.status === 'pending').length}    tone="warning" />
          <StatCard label="Deletions"  value={deletionCount}                                          tone="error" />
          <StatCard label="Exports"    value={requests.filter(r => r.type === 'export').length}       tone="info" />
          <StatCard label="Processing" value={requests.filter(r => r.status === 'processing').length} tone="lime" />
        </div>

        {/* Table */}
        <section className="overflow-hidden rounded-xl border border-border-default bg-bg-raised">
          {/* Tabs */}
          <div className="flex border-b border-border-subtle">
            {(['pending', 'all'] as Tab[]).map(t => (
              <button key={t} onClick={() => handleTabChange(t)}
                className={`px-4 py-3 text-sm font-semibold capitalize transition-colors ${
                  activeTab === t
                    ? 'border-b-2 border-lime text-text-primary'
                    : 'text-text-tertiary hover:text-text-secondary'
                }`}>
                {t === 'pending' ? 'Pending' : 'All Requests'}
              </button>
            ))}
          </div>

          {fetchError && <div className="p-4 text-sm text-error">{fetchError}</div>}

          <div className={TABLE.wrap}>
            <table className={TABLE.table}>
              <thead>
                <tr>
                  {['Type', 'User', 'Date', 'Status', 'Actions'].map(h => (
                    <th key={h} className={TABLE.th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <AnimatePresence mode="popLayout">
                  {tabLoading ? (
                    <tr><td colSpan={5} className="py-12 text-center">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin text-text-tertiary" />
                    </td></tr>
                  ) : requests.length === 0 ? (
                    <tr><td colSpan={5} className="py-12 text-center">
                      <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-success" />
                      <p className="text-sm text-text-tertiary">No {activeTab} GDPR requests.</p>
                    </td></tr>
                  ) : (
                    requests.map(req => (
                      <RequestRow
                        key={req.id}
                        req={req as any}
                        onComplete={handleComplete}
                        onReject={id => { setRejectTarget(id); setRejectReason('') }}
                        loading={loading}
                      />
                    ))
                  )}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  )
}
