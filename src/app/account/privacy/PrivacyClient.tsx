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
  Trash2, Loader2, Clock,
  CheckCircle2, XCircle, AlertTriangle, FileJson,
} from 'lucide-react'
import { SettingsCard, accountBtn } from '@/components/account/AccountSurface'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
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

interface Props {
  requests: GdprRequest[]
  /** Rendered as a Settings tab: no page header, no page container. */
  embedded?: boolean
}

export default function PrivacyClient({ requests: initialRequests, embedded = false }: Props) {
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
      a.download = `dropmarket-data-export-${new Date().toISOString().slice(0, 10)}.json`
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
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className={embedded ? 'space-y-4' : 'mx-auto w-full max-w-7xl space-y-4 px-4 pb-10 sm:px-6 lg:px-8'}
    >
      {!embedded && (
        <motion.div variants={item}>
          <AccountPageHeader
            icon="privacy"
            title="Privacy & Data"
            subtitle="Your rights under GDPR: export your data or request account deletion."
          />
        </motion.div>
      )}

      <motion.div variants={item}>
        <SettingsCard
          title="Download My Data"
          description="Export all your personal data (profile, orders, messages, reviews and more) as a JSON file. Available instantly."
          footerHint="Exercising your right under GDPR Article 20 (Right to Data Portability)."
          footerAction={
            <button type="button" onClick={handleExport} disabled={exporting} className={accountBtn.primary}>
              {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <FileJson className="h-3.5 w-3.5" aria-hidden />}
              {exporting ? 'Exporting…' : 'Download JSON'}
            </button>
          }
        />
      </motion.div>

      <motion.div variants={item}>
        <SettingsCard
          tone="danger"
          title="Request Account Deletion"
          description="Request permanent deletion of your account and all associated personal data. This action is irreversible. Any active orders must be completed or resolved first."
          aside={
            hasPendingDeletion ? (
              <span className="inline-flex h-6 items-center gap-1 rounded-full bg-warning-bg px-2.5 text-[12px] font-semibold text-warning">
                <Clock className="h-3 w-3" aria-hidden />
                Pending
              </span>
            ) : null
          }
          footerHint="Exercising your right under GDPR Article 17 (Right to Erasure). Requests are processed within 30 days."
          footerAction={
            hasPendingDeletion ? null : (
              <button type="button" onClick={() => setShowDelConfirm(true)} className={accountBtn.danger}>
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                Request Deletion
              </button>
            )
          }
        />
      </motion.div>

      {requests.length > 0 && (
        <motion.div variants={item}>
          <SettingsCard title="Request History">
            <ul className="divide-y divide-white/[0.07]">
              {requests.map(r => (
                <li key={r.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <StatusIcon status={r.status} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm capitalize text-text-primary">{r.type} request</p>
                    <p className="text-xs text-text-tertiary">
                      Submitted {new Date(r.requested_at).toLocaleDateString()}
                      {r.completed_at && `, completed ${new Date(r.completed_at).toLocaleDateString()}`}
                    </p>
                    {r.rejection_reason && (
                      <p className="mt-0.5 text-xs text-error">Rejected: {r.rejection_reason}</p>
                    )}
                  </div>
                  <span className={cn(
                    'inline-flex h-6 items-center rounded-full px-2.5 text-[12px] font-semibold capitalize',
                    r.status === 'completed' ? 'bg-success-bg text-success'
                      : r.status === 'rejected' ? 'bg-error-bg text-error'
                      : r.status === 'pending' ? 'bg-warning-bg text-warning'
                      : 'bg-white/[0.06] text-text-secondary',
                  )}>
                    {r.status}
                  </span>
                </li>
              ))}
            </ul>
          </SettingsCard>
        </motion.div>
      )}

      <motion.div variants={item} className="space-y-1 px-1 text-xs text-text-tertiary">
        <p>DropMarket processes personal data under GDPR (EU) 2016/679 and applicable privacy laws.</p>
        {/* support@, not privacy@ — matches the privacy policy's stated contact
            (lib/legal/documents.ts) and the one alias that's actually
            monitored. A dedicated privacy@ inbox would just bounce. */}
        <p>For questions, contact <span className="text-text-secondary">support@dropmarket.gg</span></p>
      </motion.div>

      <Dialog open={showDelConfirm} onOpenChange={(open) => !requestingDel && setShowDelConfirm(open)}>
        <DialogContent className="max-w-[420px] gap-0 p-5 sm:p-6">
          <AlertTriangle className="h-6 w-6 text-error" aria-hidden />
          <DialogTitle className="mt-3 text-base font-semibold text-text-primary">Delete Your Account?</DialogTitle>
          <DialogDescription className="mt-1.5 text-[13px] leading-relaxed text-text-secondary">
            This permanently deletes your account, listings, order history, messages and all personal data. It
            can&apos;t be undone.
          </DialogDescription>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setShowDelConfirm(false)} disabled={requestingDel} className={accountBtn.secondary}>
              Keep My Account
            </button>
            <button type="button" onClick={handleDeletionRequest} disabled={requestingDel} className={accountBtn.danger}>
              {requestingDel && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
              Request Deletion
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
