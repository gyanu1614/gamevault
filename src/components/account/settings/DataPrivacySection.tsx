'use client'

/**
 * Data & Privacy for the Security tab.
 *
 * The Danger Zone previously offered a link to /support and called it
 * account deletion. `src/lib/actions/gdpr.ts` already implemented export and
 * deletion requests against a `gdpr_requests` table — none of it was
 * reachable from the UI. This wires it up.
 *
 * Two tiers, following Etsy's split: exporting your data is instant and
 * harmless; deletion is a reviewed request, clearly labelled permanent, and
 * gated behind typed confirmation.
 */

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, Download, Loader2, Trash2 } from 'lucide-react'
import { exportMyData, getMyGdprRequests, submitGdprRequest } from '@/lib/actions/gdpr'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'

const CONFIRM_PHRASE = 'DELETE'

export default function DataPrivacySection() {
  const [exporting, setExporting] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [pendingDeletion, setPendingDeletion] = useState(false)

  const refresh = useCallback(async () => {
    const result = await getMyGdprRequests()
    if (result.success) {
      setPendingDeletion(
        (result.requests ?? []).some(
          (r: any) => r.type === 'deletion' && ['pending', 'processing'].includes(r.status),
        ),
      )
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const handleExport = async () => {
    setExporting(true)
    try {
      const result = await exportMyData()
      if (!result.success || !result.json) {
        toast.error(result.error || 'Couldn’t build your data export.')
        return
      }

      // Hand the JSON straight to the browser — no round trip through
      // storage, so nothing personal is left sitting on a public bucket.
      const blob = new Blob([result.json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `dropmarket-data-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast.success('Your data has been downloaded')
    } catch {
      toast.error('Couldn’t build your data export.')
    } finally {
      setExporting(false)
    }
  }

  const handleDelete = async () => {
    setSubmitting(true)
    const result = await submitGdprRequest('deletion')
    setSubmitting(false)

    if (!result.success) {
      toast.error(result.error || 'Couldn’t submit your request.')
      return
    }

    setDeleteOpen(false)
    setConfirmText('')
    toast.success('Deletion request submitted', {
      description: 'We’ll verify your identity and confirm by email.',
    })
    void refresh()
  }

  return (
    <div>
      <h2 className="mb-4 text-sm font-semibold text-text-primary">Data &amp; Privacy</h2>

      <div className="space-y-3">
        {/* Export — safe, instant */}
        <div className="flex flex-col gap-4 rounded-lg border border-border-subtle bg-bg-raised/40 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="text-sm font-medium text-text-primary">Download Your Data</div>
            <p className="mt-0.5 text-xs text-text-tertiary">
              Your profile, orders, listings, messages and reviews as a JSON file.
            </p>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-border-subtle bg-bg-overlay px-4 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-bg-raised-hover disabled:opacity-50"
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Export Data
          </button>
        </div>

        {/* Delete — permanent, gated */}
        <div className="rounded-lg border border-error/40 bg-error-bg p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-error" />
            <span className="text-sm font-semibold text-error">Delete Account</span>
          </div>
          <p className="mt-2 text-xs text-text-secondary">
            Permanently deletes your account and personal data. This can’t be undone. Records we’re
            legally required to keep — completed orders and payout history — are retained.
          </p>

          {pendingDeletion ? (
            <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-warning/20 bg-warning-bg px-4 py-2.5 text-xs font-medium text-warning">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Deletion request received — we’ll confirm by email.
            </div>
          ) : (
            <button
              onClick={() => setDeleteOpen(true)}
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-error/40 bg-error-bg px-4 py-2.5 text-sm font-semibold text-error transition-colors hover:bg-error-bg/80"
            >
              <Trash2 className="h-4 w-4" />
              Request Account Deletion
            </button>
          )}
        </div>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle>Delete Your Account</DialogTitle>
          <DialogDescription>
            This is permanent. Your listings will be removed and you’ll lose access to your order
            history. Export your data first if you want a copy.
          </DialogDescription>

          <div className="mt-4 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-secondary">
                Type <span className="font-mono text-text-primary">{CONFIRM_PHRASE}</span> to confirm
              </label>
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={CONFIRM_PHRASE}
                className="w-full rounded-lg border border-border-subtle bg-bg-raised px-4 py-2.5 text-base text-text-primary placeholder:text-text-disabled focus:border-error focus:outline-none focus:ring-2 focus:ring-error/20 sm:text-sm"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setDeleteOpen(false); setConfirmText('') }}
                className="flex-1 rounded-lg border border-border-subtle bg-bg-raised px-4 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-bg-raised-hover"
              >
                Keep My Account
              </button>
              <button
                onClick={handleDelete}
                disabled={submitting || confirmText !== CONFIRM_PHRASE}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-error/40 bg-error-bg px-4 py-2.5 text-sm font-semibold text-error transition-colors hover:bg-error-bg/80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Delete Account
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
