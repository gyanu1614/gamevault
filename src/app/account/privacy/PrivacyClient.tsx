'use client'

/**
 * P6.5 — GDPR Privacy & Data Controls Client
 *
 * Sections:
 *  1. Download My Data — triggers exportMyData() and offers JSON file download
 *  2. Request Account Deletion — submits deletion request to admin queue
 *  3. Request history — previous GDPR requests and their status
 */

import { useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  Shield, Download, Trash2, Loader2, Clock,
  CheckCircle2, XCircle, AlertTriangle, FileJson,
} from 'lucide-react'
import { exportMyData, submitGdprRequest } from '@/lib/actions/gdpr'
import type { GdprRequest } from '@/lib/actions/gdpr'

// ── Animation variants ─────────────────────────────────────────────────────

const container = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { staggerChildren: 0.07 } },
}
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }

// ── Status icon ────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'pending':    return <Clock        className="w-4 h-4 text-amber-400" />
    case 'processing': return <Loader2      className="w-4 h-4 text-blue-400 animate-spin" />
    case 'completed':  return <CheckCircle2 className="w-4 h-4 text-success" />
    case 'rejected':   return <XCircle      className="w-4 h-4 text-error" />
    default:           return null
  }
}

// ── Main component ─────────────────────────────────────────────────────────

interface Props { requests: GdprRequest[] }

export default function PrivacyClient({ requests: initialRequests }: Props) {
  const [requests,        setRequests]        = useState<GdprRequest[]>(initialRequests)
  const [exporting,       setExporting]       = useState(false)
  const [requestingDel,   setRequestingDel]   = useState(false)
  const [showDelConfirm,  setShowDelConfirm]  = useState(false)

  // ── Export data ───────────────────────────────────────────────────────────

  const handleExport = async () => {
    setExporting(true)
    const result = await exportMyData()
    setExporting(false)
    if (result.success && result.json) {
      // Trigger browser download
      const blob = new Blob([result.json], { type: 'application/json' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `gamevault-data-export-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Data export downloaded.')
    } else {
      toast.error(result.error ?? 'Export failed')
    }
  }

  // ── Request deletion ──────────────────────────────────────────────────────

  const handleDeletionRequest = async () => {
    setRequestingDel(true)
    const result = await submitGdprRequest('deletion')
    setRequestingDel(false)
    setShowDelConfirm(false)
    if (result.success) {
      toast.success('Deletion request submitted. An admin will process it within 30 days.')
      // Add optimistic request to list
      const optimistic: GdprRequest = {
        id:               result.requestId ?? '',
        user_id:          '',
        type:             'deletion',
        status:           'pending',
        requested_at:     new Date().toISOString(),
        completed_at:     null,
        processed_by:     null,
        rejection_reason: null,
        export_url:       null,
        notes:            null,
      }
      setRequests(prev => [optimistic, ...prev])
    } else {
      toast.error(result.error ?? 'Request failed')
    }
  }

  const hasPendingDeletion = requests.some(r => r.type === 'deletion' && ['pending', 'processing'].includes(r.status))

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="max-w-2xl mx-auto space-y-6 pb-10">

      {/* Header */}
      <motion.div variants={item}>
        <div className="flex items-center gap-3 mb-1">
          <Shield className="w-6 h-6 text-blue-400" />
          <h1 className="text-2xl font-bold text-white">Privacy & Data</h1>
        </div>
        <p className="text-white/40 text-sm">
          Your rights under GDPR — export your data or request account deletion.
        </p>
      </motion.div>

      {/* Data export card */}
      <motion.div variants={item} className="bg-[#0f0f0f] border border-border-subtle rounded-xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <Download className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white mb-1">Download My Data</h2>
              <p className="text-xs text-white/40">
                Export all your personal data — profile, orders, messages, reviews, and more —
                as a JSON file. Available instantly.
              </p>
              <p className="text-xs text-white/30 mt-1">
                Exercising your right under GDPR Article 20 (Right to Data Portability).
              </p>
            </div>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20
                       text-blue-400 hover:bg-blue-500/15 transition-colors disabled:opacity-50 text-sm font-medium whitespace-nowrap"
          >
            {exporting
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <FileJson className="w-4 h-4" />}
            {exporting ? 'Exporting…' : 'Download JSON'}
          </button>
        </div>
      </motion.div>

      {/* Deletion request card */}
      <motion.div variants={item} className="bg-[#0f0f0f] border border-red-500/10 rounded-xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-error-bg rounded-xl flex items-center justify-center flex-shrink-0">
              <Trash2 className="w-5 h-5 text-error" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white mb-1">Request Account Deletion</h2>
              <p className="text-xs text-white/40">
                Request permanent deletion of your account and all associated personal data.
                This action is irreversible. Any active orders must be completed or resolved first.
              </p>
              <p className="text-xs text-white/30 mt-1">
                Exercising your right under GDPR Article 17 (Right to Erasure).
                Requests are processed within 30 days.
              </p>
            </div>
          </div>

          {hasPendingDeletion ? (
            <div className="flex items-center gap-1.5 text-amber-400 text-xs whitespace-nowrap">
              <Clock className="w-4 h-4" />
              Pending
            </div>
          ) : showDelConfirm ? (
            <div className="flex items-center gap-2 whitespace-nowrap">
              <button
                onClick={() => setShowDelConfirm(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-white/50 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeletionRequest}
                disabled={requestingDel}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-error-bg text-error hover:bg-red-500/30
                           text-xs font-medium transition-colors disabled:opacity-50"
              >
                {requestingDel ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                Confirm Delete
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowDelConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-error-bg border border-error/40
                         text-error hover:bg-red-500/15 transition-colors text-sm font-medium whitespace-nowrap"
            >
              <Trash2 className="w-4 h-4" />
              Request Deletion
            </button>
          )}
        </div>

        {showDelConfirm && (
          <div className="mt-4 flex items-start gap-2 bg-error-bg rounded-lg p-3">
            <AlertTriangle className="w-4 h-4 text-error flex-shrink-0 mt-0.5" />
            <p className="text-xs text-error">
              This will permanently delete your account, listings, order history, messages, and all personal data.
              This cannot be undone. Click "Confirm Delete" to proceed.
            </p>
          </div>
        )}
      </motion.div>

      {/* Request history */}
      {requests.length > 0 && (
        <motion.div variants={item} className="bg-[#0f0f0f] border border-border-subtle rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Request History</h2>
          <div className="space-y-3">
            {requests.map(r => (
              <div key={r.id} className="flex items-center gap-3 py-2.5 border-b border-border-subtle last:border-0">
                <StatusIcon status={r.status} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white capitalize">{r.type} request</p>
                  <p className="text-xs text-white/30">
                    Submitted {new Date(r.requested_at).toLocaleDateString()}
                    {r.completed_at && ` · Completed ${new Date(r.completed_at).toLocaleDateString()}`}
                  </p>
                  {r.rejection_reason && (
                    <p className="text-xs text-error mt-0.5">Rejected: {r.rejection_reason}</p>
                  )}
                </div>
                <span className={`text-xs font-medium capitalize px-2 py-0.5 rounded ${
                  r.status === 'completed' ? 'text-success bg-success-bg' :
                  r.status === 'rejected'  ? 'text-error bg-error-bg'    :
                  r.status === 'pending'   ? 'text-amber-400 bg-amber-500/10' :
                  'text-blue-400 bg-blue-500/10'
                }`}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Legal note */}
      <motion.div variants={item} className="text-xs text-white/25 space-y-1">
        <p>GameVault processes personal data under GDPR (EU) 2016/679 and applicable privacy laws.</p>
        <p>For questions, contact <span className="text-white/40">privacy@gamevault.gg</span></p>
      </motion.div>
    </motion.div>
  )
}
