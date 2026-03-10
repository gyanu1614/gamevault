'use client'

/**
 * P6.5 — Admin GDPR Request Management Client
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
  Shield, Download, Trash2, Clock, CheckCircle2,
  XCircle, Loader2, AlertTriangle, X,
} from 'lucide-react'
import { processGdprRequest, getGdprRequests } from '@/lib/actions/gdpr'
import type { GdprRequest } from '@/lib/actions/gdpr'

// ── Animation variants ─────────────────────────────────────────────────────

const container = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { staggerChildren: 0.06 } },
}
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }

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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
    >
      {/* Type */}
      <td className="px-4 py-3">
        <div className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded ${
          isDel ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'
        }`}>
          {isDel ? <Trash2 className="w-3 h-3" /> : <Download className="w-3 h-3" />}
          {isDel ? 'Deletion' : 'Export'}
        </div>
      </td>

      {/* User */}
      <td className="px-4 py-3">
        <p className="text-sm text-white">{req.username ? `@${req.username}` : '—'}</p>
        <p className="text-xs text-white/30">{req.email}</p>
      </td>

      {/* Date */}
      <td className="px-4 py-3 text-xs text-white/40">
        {new Date(req.requested_at).toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric',
        })}
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <span className={`text-xs font-medium capitalize px-2 py-0.5 rounded ${
          req.status === 'completed' ? 'text-green-400 bg-green-500/10' :
          req.status === 'rejected'  ? 'text-red-400 bg-red-500/10'    :
          req.status === 'pending'   ? 'text-amber-400 bg-amber-500/10' :
          'text-blue-400 bg-blue-500/10'
        }`}>
          {req.status}
        </span>
        {req.rejection_reason && (
          <p className="text-[10px] text-red-400/70 mt-0.5 max-w-[160px] truncate">{req.rejection_reason}</p>
        )}
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        {req.status === 'pending' || req.status === 'processing' ? (
          <div className="flex items-center gap-1.5">
            <button
              disabled={busy}
              onClick={() => onComplete(req.id)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors disabled:opacity-40
                ${isDel
                  ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                  : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                }`}
            >
              {busy
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : isDel ? <Trash2 className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />
              }
              {isDel ? 'Delete Account' : 'Mark Done'}
            </button>
            <button
              disabled={busy}
              onClick={() => onReject(req.id)}
              className="flex items-center gap-1 px-2 py-1 rounded text-[11px] bg-white/[0.05] text-white/40 hover:bg-white/[0.08] transition-colors disabled:opacity-40"
            >
              <X className="w-3 h-3" />
              Reject
            </button>
          </div>
        ) : (
          <span className="text-xs text-white/20">
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
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-[#111] border border-white/[0.08] rounded-2xl p-6 max-w-md w-full"
            >
              <h3 className="text-white font-semibold mb-3">Rejection Reason</h3>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="Reason for rejection (e.g., active orders pending, outstanding seller balance)…"
                rows={4}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm
                           text-white placeholder:text-white/20 focus:outline-none resize-none mb-4"
              />
              <div className="flex gap-2 justify-end">
                <button onClick={() => setRejectTarget(null)} className="px-4 py-2 text-sm text-white/50 hover:text-white">
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={!rejectReason.trim()}
                  className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 text-sm font-medium disabled:opacity-40"
                >
                  Reject Request
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 pb-10">
        {/* Header */}
        <motion.div variants={item} className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-blue-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">GDPR Requests</h1>
            <p className="text-white/40 text-sm">Data export and account deletion requests.</p>
          </div>
        </motion.div>

        {/* Deletion warning */}
        {deletionCount > 0 && (
          <motion.div variants={item} className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-400">{deletionCount} Account Deletion Request{deletionCount !== 1 ? 's' : ''}</p>
              <p className="text-xs text-white/50 mt-0.5">
                Completing a deletion request is irreversible. Verify: no active orders, seller balance = 0,
                no pending payouts. The auth user will be permanently deleted.
              </p>
            </div>
          </motion.div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Pending',    value: requests.filter(r => r.status === 'pending').length,    color: 'text-amber-400', bg: 'bg-amber-500/10' },
            { label: 'Deletions',  value: deletionCount,                                          color: 'text-red-400',   bg: 'bg-red-500/10'   },
            { label: 'Exports',    value: requests.filter(r => r.type === 'export').length,       color: 'text-blue-400',  bg: 'bg-blue-500/10'  },
            { label: 'Processing', value: requests.filter(r => r.status === 'processing').length, color: 'text-violet-400', bg: 'bg-violet-500/10' },
          ].map(c => (
            <motion.div key={c.label} variants={item}
              className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-4">
              <p className={`text-xl font-bold font-mono ${c.color}`}>{c.value}</p>
              <p className="text-xs text-white/40 mt-0.5">{c.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Table */}
        <motion.div variants={item} className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-white/[0.06]">
            {(['pending', 'all'] as Tab[]).map(t => (
              <button key={t} onClick={() => handleTabChange(t)}
                className={`px-4 py-3 text-sm font-medium capitalize transition-colors ${
                  activeTab === t ? 'text-white border-b-2 border-blue-400' : 'text-white/40 hover:text-white/60'
                }`}>
                {t === 'pending' ? 'Pending' : 'All Requests'}
              </button>
            ))}
          </div>

          {fetchError && <div className="p-4 text-sm text-red-400">{fetchError}</div>}

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  {['Type', 'User', 'Date', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] uppercase tracking-wider text-white/30">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <AnimatePresence mode="popLayout">
                  {tabLoading ? (
                    <tr><td colSpan={5} className="py-12 text-center">
                      <Loader2 className="w-6 h-6 animate-spin text-white/30 mx-auto" />
                    </td></tr>
                  ) : requests.length === 0 ? (
                    <tr><td colSpan={5} className="py-12 text-center">
                      <CheckCircle2 className="w-8 h-8 text-green-400/50 mx-auto mb-2" />
                      <p className="text-sm text-white/30">No {activeTab} GDPR requests.</p>
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
        </motion.div>
      </motion.div>
    </>
  )
}
