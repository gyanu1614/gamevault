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
import AccountPageHeader from '@/components/account/AccountPageHeader'
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
    case 'pending':    return <Clock        className="w-4 h-4 text-warning" />
    case 'processing': return <Loader2      className="w-4 h-4 text-lime-text animate-spin" />
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
    <motion.div variants={container} initial="hidden" animate="show" className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 space-y-6 pb-10">

      {/* V21/P7.al — Standard account header. */}
      <motion.div variants={item}>
        <AccountPageHeader
          icon="privacy"
          title="Privacy & Data"
          subtitle="Your rights under GDPR — export your data or request account deletion."
        />
      </motion.div>

      {/* Data export card */}
      <motion.div variants={item} className="rounded-lg border border-border-subtle card-frost p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-lime-tint-border bg-lime/10">
              <Download className="h-5 w-5 text-lime-text" />
            </div>
            <div>
              <h2 className="mb-1 text-sm font-semibold text-text-primary">Download My Data</h2>
              <p className="text-xs text-text-secondary">
                Export all your personal data — profile, orders, messages, reviews, and more —
                as a JSON file. Available instantly.
              </p>
              <p className="mt-1 text-xs text-text-tertiary">
                Exercising your right under GDPR Article 20 (Right to Data Portability).
              </p>
            </div>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 whitespace-nowrap rounded-lg bg-lime px-4 py-2 text-sm font-semibold text-text-inverse transition-colors hover:bg-lime/90 disabled:opacity-50"
          >
            {exporting
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <FileJson className="h-4 w-4" />}
            {exporting ? 'Exporting…' : 'Download JSON'}
          </button>
        </div>
      </motion.div>

      {/* Deletion request card */}
      <motion.div variants={item} className="rounded-lg border border-error/20 card-frost p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-error/30 bg-error-bg">
              <Trash2 className="h-5 w-5 text-error" />
            </div>
            <div>
              <h2 className="mb-1 text-sm font-semibold text-text-primary">Request Account Deletion</h2>
              <p className="text-xs text-text-secondary">
                Request permanent deletion of your account and all associated personal data.
                This action is irreversible. Any active orders must be completed or resolved first.
              </p>
              <p className="mt-1 text-xs text-text-tertiary">
                Exercising your right under GDPR Article 17 (Right to Erasure).
                Requests are processed within 30 days.
              </p>
            </div>
          </div>

          {hasPendingDeletion ? (
            <div className="flex items-center gap-1.5 whitespace-nowrap text-xs text-warning">
              <Clock className="h-4 w-4" />
              Pending
            </div>
          ) : showDelConfirm ? (
            <div className="flex items-center gap-2 whitespace-nowrap">
              <button
                onClick={() => setShowDelConfirm(false)}
                className="rounded-lg px-3 py-1.5 text-xs text-text-secondary transition-colors hover:text-text-primary"
              >
                Cancel
              </button>
              <button
                onClick={handleDeletionRequest}
                disabled={requestingDel}
                className="flex items-center gap-1 rounded-lg border border-error/40 bg-error-bg px-3 py-1.5 text-xs font-medium text-error transition-colors hover:bg-error/20 disabled:opacity-50"
              >
                {requestingDel ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                Confirm Delete
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowDelConfirm(true)}
              className="flex items-center gap-2 whitespace-nowrap rounded-lg border border-error/40 bg-error-bg px-4 py-2 text-sm font-medium text-error transition-colors hover:bg-error/20"
            >
              <Trash2 className="h-4 w-4" />
              Request Deletion
            </button>
          )}
        </div>

        {showDelConfirm && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-error/20 bg-error-bg p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-error" />
            <p className="text-xs text-error">
              This will permanently delete your account, listings, order history, messages, and all personal data.
              This cannot be undone. Click "Confirm Delete" to proceed.
            </p>
          </div>
        )}
      </motion.div>

      {/* Request history */}
      {requests.length > 0 && (
        <motion.div variants={item} className="rounded-lg border border-border-subtle card-frost p-5">
          <h2 className="mb-4 text-sm font-semibold text-text-primary">Request History</h2>
          <div className="space-y-3">
            {requests.map(r => (
              <div key={r.id} className="flex items-center gap-3 border-b border-border-subtle py-2.5 last:border-0">
                <StatusIcon status={r.status} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm capitalize text-text-primary">{r.type} request</p>
                  <p className="text-xs text-text-tertiary">
                    Submitted {new Date(r.requested_at).toLocaleDateString()}
                    {r.completed_at && ` · Completed ${new Date(r.completed_at).toLocaleDateString()}`}
                  </p>
                  {r.rejection_reason && (
                    <p className="mt-0.5 text-xs text-error">Rejected: {r.rejection_reason}</p>
                  )}
                </div>
                <span className={`rounded px-2 py-0.5 text-xs font-medium capitalize ${
                  r.status === 'completed' ? 'text-success bg-success-bg' :
                  r.status === 'rejected'  ? 'text-error bg-error-bg'    :
                  r.status === 'pending'   ? 'text-warning bg-warning-bg' :
                  'text-text-secondary bg-white/[0.06]'
                }`}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Legal note */}
      <motion.div variants={item} className="space-y-1 text-xs text-text-tertiary">
        <p>GameVault processes personal data under GDPR (EU) 2016/679 and applicable privacy laws.</p>
        <p>For questions, contact <span className="text-text-secondary">privacy@gamevault.gg</span></p>
      </motion.div>
    </motion.div>
  )
}
